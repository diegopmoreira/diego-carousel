import type { Browser, Page } from 'playwright';
import path from 'node:path';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { hash, writeJson } from '../project/io.js';
import { compose } from './compose.js';
import { inkCheck, type InkReport } from './ink.js';
import { slideMetrics } from './metrics.js';
import type { CarouselData, ArtData, TweaksData } from '../schema/index.js';
// One slide, from HTML to verdict: fit in the browser, ink map with per-line spacing, metrics, checks, screenshot.
// Everything here changes pixels or pass/fail, so this file is part of the render environment hash.
async function browserChecks(page:Page){
 const geometry=await page.evaluate(()=>{
  const errors:string[]=[];
  const blocks=[...document.querySelectorAll<HTMLElement>('[data-role]')];
  const rects=blocks.map(el=>{const r=el.getBoundingClientRect();const style=getComputedStyle(el);const floor=Number(el.dataset.floor);if(parseFloat(style.fontSize)<floor)errors.push(`${el.dataset.role}: fonte abaixo do piso`);const safeBottom=Number(document.body.dataset.safeBottom||1230);if(r.x<49||r.right>1031||r.y<50||r.bottom>safeBottom)errors.push(`${el.dataset.role}: fora da margem segura`);if(el.scrollWidth>el.clientWidth+1)errors.push(`${el.dataset.role}: overflow horizontal`);return r;});
  if(rects.length===2&&rects[0].bottom>rects[1].top+.5)errors.push('Headline e body se sobrepõem');
  if(document.documentElement.scrollWidth>1080||document.documentElement.scrollHeight>1350)errors.push('Canvas excedido');
  return errors;
 });
 const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
 // Every element that draws text, not only headline/body lines: badge, handle, cue and page number too.
 const {root}=await cdp.send('DOM.getDocument');const {nodeIds}=await cdp.send('DOM.querySelectorAll',{nodeId:root.nodeId,selector:'.slide *'});
 const fonts=[];
 const fallback:string[]=[];
 for(const nodeId of nodeIds){const r=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});fonts.push(...r.fonts);for(const f of r.fonts)if(f.glyphCount>0&&!f.isCustomFont){const {outerHTML}=await cdp.send('DOM.getOuterHTML',{nodeId});fallback.push(`${f.familyName} em ${outerHTML.slice(0,60)}`);}}
 await cdp.detach();
 if(!fonts.length)geometry.push('Nenhuma fonte registrada pelo Chromium');
 for(const f of fallback)geometry.push(`Fonte fallback detectada: ${f}`);
 return {errors:geometry,fonts:[...new Set(fonts.map(f=>f.familyName))]};
}
export async function renderSlide({browser,serverUrl,dir,num,index:i,carousel:c,art:a,tweaks:t,config,tokens,assetUrl,file}:{browser:Browser;serverUrl:string;dir:string;num:string;index:number;carousel:CarouselData;art:ArtData;tweaks:TweaksData;config:any;tokens:any;assetUrl?:string;file:string}){
 const s=c.slides[i],server={url:serverUrl};let page:Page|undefined;
 try{
  page=await browser.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:1,colorScheme:'dark'});
  let errors:string[]=[];
  // tsx keeps function names with a __name helper that does not exist inside the page; evaluate callbacks need it.
  await page.addInitScript('globalThis.__name=globalThis.__name||(f=>f)');
  await page.route('**/*',route=>route.request().url().startsWith(server.url+'/')?route.continue():route.abort());
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>errors.push(`Request falhou: ${r.url()}`));page.on('response',r=>{if(r.status()>=400)errors.push(`HTTP ${r.status()}: ${r.url()}`);});
  // Fit, then the ink map. When accents or cedillas of neighbouring headline lines touch, the headline gets more
  // leading and the fit runs again (the ladder of editorial/visual decisions is unchanged).
  const family=tokens.families[a.family],maxExtra=(tokens.ink?.max_extra_em??.25),step=tokens.ink?.step??.03;
  const lineSpace:Record<number,number>={};let state:any,ink:InkReport|undefined,attempts=0,headlineCeiling:number|undefined;
  for(;attempts<40;attempts++){
   errors=[];
   await writeFile(file,compose(c,a,t,i,config,tokens,assetUrl,undefined,{lineSpace,headlineCeiling}));
   await page.goto(`${server.url}/project/html/slide-${num}.html`);
   await page.waitForFunction(()=> (window as any).__slideReady===true,{},{timeout:30000});
   state=await page.evaluate(()=>({fit:(window as any).__fit,error:(window as any).__fitError}));
   if(state.error)throw Error(state.error);
   ink=await inkCheck(page,{minGapEm:tokens.ink?.min_gap_em,headlineBodyGap:tokens.ink?.headline_body_gap,safeX:tokens.ink?.safe_x});
   // A filled headline sized to its layout box can still spill ink (Anton overhangs) past the safe area:
   // lower the fill ceiling a few px and fit again, never below the size the composition starts from.
   const filled=state.fit.stages.includes('headline-fill');
   if(ink.outside>0&&filled){headlineCeiling=state.fit.blocks.headline.size-4;for(const k of Object.keys(lineSpace))delete lineSpace[Number(k)];continue;}
   if(ink.headline_ok)break;
   const size=state.fit.blocks.headline.size,limit=Math.round(maxExtra*size),add=Math.ceil(step*size);
   const open=ink.collisions.filter(k=>(lineSpace[k]??0)<limit);
   if(!open.length)break;
   for(const k of open)lineSpace[k]=Math.min(limit,(lineSpace[k]??0)+add);
  }
  // A failing ink map is measured once more before it fails the slide: a screenshot taken mid-paint must not
  // fail a render that is fine (seen once in hundreds of runs, never reproduced).
  if(ink&&!ink.passed){const again=await inkCheck(page,{minGapEm:tokens.ink?.min_gap_em,headlineBodyGap:tokens.ink?.headline_body_gap,safeX:tokens.ink?.safe_x});if(again.passed)ink=again;}
  // The last ink map stays in qa/ink for inspection; it never goes to export.
  const {png:inkPng,...inkReport}=ink!;if(inkPng){await mkdir(path.join(dir,'qa/ink'),{recursive:true});await writeFile(path.join(dir,`qa/ink/${num}.png`),inkPng);}
  state.fit.ink={line_height:family.headlineLineHeight,line_space:lineSpace,attempts,...inkReport};
  // Large openings keep the text legible but break the rhythm: flagged for the visual review, not a failure.
  const warnings:string[]=[];const warnAt=Math.round((tokens.ink?.warn_extra_em??.4)*state.fit.blocks.headline.size);
  for(const [k,v] of Object.entries(lineSpace))if(v>warnAt)warnings.push(`Mapa de tinta: ${v}px extras acima da linha ${Number(k)+1} do título (acentos colidindo); considerar outra quebra ou tamanho`);
  if(Object.keys(lineSpace).length)state.fit.stages.push(`ink-space:${Object.entries(lineSpace).map(([k,v])=>`L${Number(k)+1}+${v}px`).join(',')}`);
  const metrics=await slideMetrics(page,inkPng,(t.slides[s.id]?.composition??a.slides[s.id].composition));warnings.push(...metrics.warnings);state.fit.metrics={contrast:metrics.contrast,empty_band_pct:metrics.empty_band_pct};
  const checks=await browserChecks(page);errors.push(...checks.errors,...ink!.errors.map(e=>`Mapa de tinta: ${e}`));
  if(!state.fit.passed)errors.push('Texto não cabe: ajustar composição ou solicitar compressão editorial');
  await writeJson(path.join(dir,`fit/${s.id}.json`),state.fit);
  await writeFile(file,compose(c,a,t,i,config,tokens,assetUrl,state.fit,{lineSpace,headlineCeiling}));
  const png=await page.screenshot({type:'png'});await writeFile(path.join(dir,`qa/render/${num}.png`),png);
  return {record:{warnings,png_hash:hash(png),fit_hash:hash(await readFile(path.join(dir,`fit/${s.id}.json`))),html_hash:hash(await readFile(file)),passed:!errors.length,errors,fonts:checks.fonts},fit:state.fit};
 }finally{await page?.close();}
}
