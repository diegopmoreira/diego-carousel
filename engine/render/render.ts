import type { Page } from 'playwright';
import { loadConfig, type ConfigData } from '../project/config.js';
import { launchChromium, chromiumPath } from './browser.js';
import sharp from 'sharp';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, loadProject, jsonHash, hash, writeJson, readJson, optionalJson, safeChild, log, contentDir, withLock } from '../project/io.js';
import { lint, visualLint } from '../qa/lint.js';
import { serve } from '../preview/server.js';
import { compose } from './compose.js';
import { VERSION } from '../schema/index.js';
import { zipFiles } from '../export/zip.js';
import { workbenchHtml } from '../preview/page.js';
import { toCopy } from '../source/copy.js';
// Only files that reach the pixels: the slide runtime, CSS, tokens, fonts, processed avatar and HTML composer.
// Tests, the studio UI and unrelated engine code must not invalidate renders.
export const PIXEL_FILES=['design/base.css','design/runtime/slide.js','design/runtime/linebreak.js','design/tokens.json','design/fonts/fonts.css','engine/render/compose.ts','engine/source/copy.ts'];
export async function environmentHash(config:ConfigData,root=ROOT){
 const fonts=(await readJson(path.join(root,'design/fonts/manifest.json'))).map((f:any)=>'design/fonts/'+f.file);
 const files=[...PIXEL_FILES,...fonts,...(config.branding.avatar?['design/'+config.branding.avatar]:[])];
 const hashes=await Promise.all(files.map(async f=>[f,hash(await readFile(path.join(root,f)))]));
 const playwright=(await readJson(path.join(ROOT,'node_modules/playwright/package.json'))).version;
 return jsonHash({files:hashes,branding:config.branding,version:VERSION,playwright,chromium:chromiumPath()});
}
export async function renderInputs(dir:string){
 const base=await contentDir(dir),p=await loadProject(dir),config=await loadConfig(),tokens=await readJson(path.join(ROOT,'design/tokens.json'));
 const environment=await environmentHash(config);
 const assetHashes:Record<string,string>={};
 for(const asset of p.assets.assets){const bytes=await readFile(safeChild(base,asset.file));const h=hash(bytes);if(h!==asset.sha256)throw Error(`Asset ${asset.id}: SHA-256 difere do manifesto`);assetHashes[asset.id]=h;}
 const slides=p.carousel.slides.map((s,i)=>({id:s.id,input_hash:jsonHash({s,d:p.art.slides[s.id],family:p.art.family,t:p.tweaks.slides[s.id],environment,index:i,total:p.carousel.slides.length,asset:p.art.slides[s.id]?.image.asset_id?assetHashes[p.art.slides[s.id].image.asset_id!]:null})}));
 return {...p,config,tokens,environment,slides,project_hash:jsonHash({p,environment,slides})};
}
async function browserChecks(page:Page){
 const geometry=await page.evaluate(()=>{
  const errors:string[]=[];
  const blocks=[...document.querySelectorAll<HTMLElement>('[data-role]')];
  const rects=blocks.map(el=>{const r=el.getBoundingClientRect();const style=getComputedStyle(el);const floor=Number(el.dataset.floor);if(parseFloat(style.fontSize)<floor)errors.push(`${el.dataset.role}: fonte abaixo do piso`);if(r.x<49||r.right>1031||r.y<50||r.bottom>1230)errors.push(`${el.dataset.role}: fora da margem segura`);if(el.scrollWidth>el.clientWidth+1)errors.push(`${el.dataset.role}: overflow horizontal`);return r;});
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
export function render(dir:string,only?:string[]){return withLock(dir,()=>renderUnlocked(dir,only));}
async function renderUnlocked(dir:string,only?:string[]){
 const editorial=await lint(dir);if(!editorial.passed)throw Error('Lint editorial falhou; consulta qa/editorial-lint.json');
 const visual=await visualLint(dir);if(visual.length)throw Error(visual.join('\n'));
 const input=await renderInputs(dir);const {carousel:c,art:a,tweaks:t,config,tokens}=input;
 if(only?.some(id=>!c.slides.some(s=>s.id===id)))throw Error('ID de slide desconhecido');
 const previous=await optionalJson(path.join(dir,'render-manifest.json'));
 for(const folder of ['qa/render','html','fit','preview'])await mkdir(path.join(dir,folder),{recursive:true});
 const server=await serve(dir);let browser;
 const records:any[]=[];
 try{
  browser=await launchChromium({args:['--force-color-profile=srgb']});
  const browserVersion=browser.version();
  for(let i=0;i<c.slides.length;i++){
   const s=c.slides[i],fingerprint=input.slides[i],num=String(i+1).padStart(2,'0');const old=previous?.slides.find((r:any)=>r.id===s.id);
   let intact=false;
   if(old){try{intact=old.png_hash===hash(await readFile(path.join(dir,`qa/render/${num}.png`)))&&old.fit_hash===hash(await readFile(path.join(dir,`fit/${s.id}.json`)))&&old.html_hash===hash(await readFile(path.join(dir,`html/slide-${num}.html`)));}catch{}}
   if(old&&old.input_hash===fingerprint.input_hash&&intact){records.push(old);continue;}
   if(only&&!only.includes(s.id)){if(old)records.push(old);continue;}
   const asset=input.assets.assets.find(x=>x.id===a.slides[s.id].image.asset_id);const assetUrl=asset?'/project/'+asset.file.split('/').map(encodeURIComponent).join('/'):undefined;
   const file=path.join(dir,`html/slide-${num}.html`);
   await writeFile(file,compose(c,a,t,i,config,tokens,assetUrl));
   const page=await browser.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:1,colorScheme:'dark'});
   const errors:string[]=[];
   await page.route('**/*',route=>route.request().url().startsWith(server.url+'/')?route.continue():route.abort());
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>errors.push(`Request falhou: ${r.url()}`));page.on('response',r=>{if(r.status()>=400)errors.push(`HTTP ${r.status()}: ${r.url()}`);});
   await page.goto(`${server.url}/project/html/slide-${num}.html`);
   await page.waitForFunction(()=> (window as any).__slideReady===true,{},{timeout:30000});
   const state=await page.evaluate(()=>({fit:(window as any).__fit,error:(window as any).__fitError}));
   if(state.error)throw Error(state.error);
   const checks=await browserChecks(page);errors.push(...checks.errors);
   if(!state.fit.passed)errors.push('Texto não cabe: ajustar composição ou solicitar compressão editorial');
   await writeJson(path.join(dir,`fit/${s.id}.json`),state.fit);
   await writeFile(file,compose(c,a,t,i,config,tokens,assetUrl,state.fit));
   const png=await page.screenshot({type:'png'});await writeFile(path.join(dir,`qa/render/${num}.png`),png);
   records.push({position:i+1,...fingerprint,png_hash:hash(png),fit_hash:hash(await readFile(path.join(dir,`fit/${s.id}.json`))),html_hash:hash(await readFile(file)),passed:!errors.length,errors,fonts:checks.fonts});
   await log(dir,'FIT',`${s.id}: ${state.fit.stages.join(' → ')}; overflow=${Math.round(state.fit.overflow_px)}px${state.fit.needs.length?`; requer ${state.fit.needs.join(' ou ')}`:''}; ${errors.length?'FALHA':'OK'}`);
   await page.close();
  }
  const manifest={schema_version:1,engine_version:VERSION,browser:browserVersion,environment:input.environment,project_hash:input.project_hash,created_at:new Date().toISOString(),slides:records,render_hash:jsonHash(records)};
  await writeJson(path.join(dir,'render-manifest.json'),manifest);
  await writeFile(path.join(dir,'copy.md'),toCopy(c.slides));
  await buildPreview(dir,c.slides.length);
  await log(dir,'RENDER',`${records.length} painéis; ${records.filter(r=>!r.passed).length} falhas`);
  return manifest;
 }finally{await browser?.close();await server.close();}
}
export async function buildPreview(dir:string,count:number){
 const tiles=[];
 for(let i=0;i<count;i++){try{const input=await sharp(path.join(dir,`qa/render/${String(i+1).padStart(2,'0')}.png`)).resize(216,270).toBuffer();tiles.push({input,left:(i%5)*228+12,top:Math.floor(i/5)*282+12});}catch{}}
 const height=Math.ceil(count/5)*282+12;
 await sharp({create:{width:1152,height,channels:3,background:'#292929'}}).composite(tiles).png().toFile(path.join(dir,'qa/contact-sheet.png'));
 const images=Array.from({length:count},(_,i)=>`<figure><img loading="lazy" src="../qa/render/${String(i+1).padStart(2,'0')}.png" alt="Painel ${i+1}"><figcaption>P${i+1}</figcaption></figure>`).join('');
 await writeFile(path.join(dir,'preview/index.html'),workbenchHtml(images));
}
export async function validate(dir:string){
 const errors:string[]=[];const editorial=await lint(dir);errors.push(...editorial.issues.filter(i=>i.severity==='error').map(i=>`${i.path}: ${i.message}`),...await visualLint(dir));
 const input=await renderInputs(dir),manifest=await optionalJson(path.join(dir,'render-manifest.json'));
 if(!manifest)errors.push('Render ausente');
 else{
  if(manifest.project_hash!==input.project_hash)errors.push('Render desatualizado: conteúdo, configuração ou assets mudaram');
  if(manifest.render_hash!==jsonHash(manifest.slides))errors.push('Manifesto de render inconsistente');
  if(manifest.slides.length!==input.slides.length)errors.push('Render incompleto');
  for(let i=0;i<input.slides.length;i++){
   const s=input.slides[i],r=manifest.slides.find((r:any)=>r.id===s.id);const num=String(i+1).padStart(2,'0');
   if(!r||r.input_hash!==s.input_hash||r.position!==i+1||!r.passed){errors.push(`${s.id}: render ausente, antigo ou reprovado`);continue;}
   try{const png=await readFile(path.join(dir,`qa/render/${num}.png`));const m=await sharp(png).metadata();if(m.width!==1080||m.height!==1350||hash(png)!==r.png_hash)errors.push(`${s.id}: PNG inválido`);if(hash(await readFile(path.join(dir,`fit/${s.id}.json`)))!==r.fit_hash||hash(await readFile(path.join(dir,`html/slide-${num}.html`)))!==r.html_hash)errors.push(`${s.id}: fit ou HTML alterado`);}catch{errors.push(`${s.id}: artefato ausente`);}
  }
 }
 for(const [id,d] of Object.entries(input.art.slides))if(d.image.need&&!d.image.asset_id)errors.push(`${id}: imagem necessária ainda é placeholder`);
 const result={schema_version:1,passed:!errors.length,project_hash:input.project_hash,render_hash:manifest?.render_hash??null,errors};await writeJson(path.join(dir,'qa/validation.json'),result);return result;
}
export type Reviewer={name:string;kind:'agent'|'human'};
// Automatic cycles are counted per distinct render reviewed by the agent since the last human review.
// Re-reviewing the same render does not spend a cycle; a person can always review.
export async function review(dir:string,reviewer:Reviewer,notes:string,approved:boolean){
 const validation=await validate(dir);if(!validation.passed)throw Error('Corrigir validação antes de registrar revisão visual');
 if(!reviewer.name.trim())throw Error('Informe quem revisou');
 const previous=await optionalJson(path.join(dir,'qa/visual-review.json'));
 const history:any[]=previous?.history??(previous?[{render_hash:previous.render_hash,approved:previous.approved,reviewer:previous.reviewer,kind:'human',notes:previous.notes,created_at:previous.created_at}]:[]);
 const lastHuman=history.findLastIndex(h=>h.kind==='human');
 const agentRenders=new Set(history.slice(lastHuman+1).filter(h=>h.kind==='agent').map(h=>h.render_hash));
 const max=(await loadConfig()).qa.max_auto_revision_cycles;
 if(reviewer.kind==='agent'&&!agentRenders.has(validation.render_hash)&&agentRenders.size>=max)throw Error(`Limite de ${max} ciclos automáticos atingido; revisão humana necessária (review --human).`);
 const cycles=reviewer.kind==='agent'?new Set([...agentRenders,validation.render_hash]).size:0;
 const entry={render_hash:validation.render_hash,approved,reviewer:reviewer.name,kind:reviewer.kind,notes,created_at:new Date().toISOString()};
 await writeJson(path.join(dir,'qa/visual-review.json'),{schema_version:2,...entry,cycles,history:[...history,entry]});
}
export function exportProject(dir:string){return withLock(dir,()=>exportUnlocked(dir));}
async function exportUnlocked(dir:string){
 const v=await validate(dir);if(!v.passed)throw Error(v.errors.join('\n'));
 const review=await optionalJson(path.join(dir,'qa/visual-review.json'));
 if(!review?.approved||review.render_hash!==v.render_hash)throw Error('Revisão visual aprovada ausente ou desatualizada');
 const {carousel}=await loadProject(dir);const out=path.join(dir,'export'),stamp=Date.now().toString();
 const stage=path.join(dir,'qa',`export-${stamp}`);await mkdir(stage,{recursive:true});
 const files=[];
 for(let i=0;i<carousel.slides.length;i++){const name=String(i+1).padStart(2,'0')+'.png';const data=await readFile(path.join(dir,'qa/render',name));await writeFile(path.join(stage,name),data);files.push({name,data});}
 const archive=zipFiles(files);await writeFile(path.join(dir,'qa/carrossel.zip'),archive);
 // Archive the preceding export rather than deleting it during replacement.
 try{await rename(out,path.join(dir,'qa',`previous-export-${stamp}`));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 await rename(stage,out);
 await writeJson(path.join(dir,'qa/export-receipt.json'),{render_hash:v.render_hash,project_hash:v.project_hash,zip_hash:hash(archive),created_at:new Date().toISOString(),files:files.map(f=>({name:f.name,sha256:hash(f.data)}))});
 await log(dir,'EXPORT',`${carousel.slides.length} PNG aprovados e ZIP`);return out;
}
