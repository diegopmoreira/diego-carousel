import path from 'node:path';
import { contentDir, loadProject, readJson, writeJson, log, withLock } from '../project/io.js';
import { withTempVariant } from '../project/variants.js';
import { IMAGE_COMPOSITIONS, Composition } from '../schema/index.js';
import { render } from './render.js';
import type { z } from 'zod';
type Comp=z.infer<typeof Composition>;
const TEXT:Comp[]=['text_only','quote','contrast','minimal_pause','giant_statement'];
// Step 3 of the fit ladder: which compositions hold this slide's text, at what sizes, and how much would have to go.
export async function fitProbe(dir:string,slide:string){
 const base=await contentDir(dir),p=await loadProject(dir),d=p.art.slides[slide];
 if(!d)throw Error('Slide desconhecido');
 const s=p.carousel.slides.find(x=>x.id===slide)!,current=(p.tweaks.slides[slide]?.composition??d.composition) as Comp;
 const withImage=!!d.image.asset_id||d.image.need||d.image.placeholder;
 const options=[...new Set([current,...TEXT.filter(c=>s.body||c==='giant_statement'||c==='minimal_pause'),...(withImage?IMAGE_COMPOSITIONS as Comp[]:[])])];
 const results=[];
 for(const composition of options){
  results.push(await withTempVariant(base,'fit-probe',async variant=>{
   const art=await readJson(path.join(variant,'art-direction.json')),tweaks=await readJson(path.join(variant,'tweaks.json'));
   art.slides[slide].composition=composition;if(tweaks.slides[slide])delete tweaks.slides[slide].composition;
   if(!IMAGE_COMPOSITIONS.includes(composition)){art.slides[slide].image={...art.slides[slide].image,need:false,placeholder:false};delete art.slides[slide].image.asset_id;}
   if(TEXT.includes(composition))art.slides[slide].layout.headline_position='center';
   await writeJson(path.join(variant,'art-direction.json'),art);await writeJson(path.join(variant,'tweaks.json'),tweaks);
   const manifest=await render(variant,[slide]).catch(e=>({slides:[{id:slide,passed:false,errors:[String(e.message??e)]}]}) as any);
   const record=manifest.slides.find((r:any)=>r.id===slide);
   const fit=await readJson(path.join(variant,`fit/${slide}.json`)).catch(()=>null);
   const body=fit?.blocks?.body,cut=body&&body.chars_that_fit<body.chars?s.body!.replace(/\*\*/g,'').slice(body.chars_that_fit).trim().split(/\s+/).filter(Boolean).length:0;
   return {composition,current:composition===current,passed:!!record?.passed,shrunk:!!fit?.stages?.some((x:string)=>x.startsWith('font-floor')),headline_px:fit?.blocks?.headline?.size??null,body_px:body?.size??null,overflow_px:fit?Math.round(fit.overflow_px):null,words_to_cut:cut,errors:record?.errors??[]};
  }));
 }
 // Best first: passes, keeps the preferred sizes, larger text.
 results.sort((a,b)=>Number(b.passed)-Number(a.passed)||Number(a.shrunk)-Number(b.shrunk)||(b.body_px??0)-(a.body_px??0)||(b.headline_px??0)-(a.headline_px??0));
 return {slide,current,results};
}
// Applies step 3 automatically to slides that fail or had to shrink: the best composition that fits without breaking
// the rhythm (never three equal in a row) becomes a studio-style override in tweaks.json.
export async function autofit(dir:string){
 const manifest=await readJson(path.join(dir,'render-manifest.json')).catch(()=>null);
 if(!manifest)throw Error('Renderizar antes do autofit');
 const changes:{slide:string;changed:boolean;from?:string;to?:string;reason?:string}[]=[];
 for(const record of manifest.slides){
  const fit=await readJson(path.join(dir,`fit/${record.id}.json`)).catch(()=>null);
  if(record.passed&&!fit?.stages?.some((x:string)=>x.startsWith('font-floor')))continue;
  const probe=await fitProbe(dir,record.id);
  await withLock(dir,async()=>{
   const p=await loadProject(dir),ids=p.carousel.slides.map(s=>s.id),i=ids.indexOf(record.id);
   const comp=(id:string)=>p.tweaks.slides[id]?.composition??p.art.slides[id].composition;
   const choice=probe.results.find(r=>r.passed&&!r.current&&!(i>=2&&comp(ids[i-1])===r.composition&&comp(ids[i-2])===r.composition)&&!(i>=1&&i<ids.length-1&&comp(ids[i-1])===r.composition&&comp(ids[i+1])===r.composition)&&!(i<ids.length-2&&comp(ids[i+1])===r.composition&&comp(ids[i+2])===r.composition));
   if(!choice){changes.push({slide:record.id,changed:false,reason:'nenhuma composição cabe: compressão editorial (full) ou autorização (copy pronta)'});return;}
   const tw=p.tweaks.slides[record.id]??={params:{}};tw.composition=choice.composition as any;
   await writeJson(path.join(dir,'tweaks.json'),p.tweaks);
   await log(dir,'FIX',`${record.id}: composição ${probe.current} → ${choice.composition} (autofit)`);
   changes.push({slide:record.id,changed:true,from:probe.current,to:choice.composition});
  });
 }
 return {changes};
}
