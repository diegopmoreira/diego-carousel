import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { Carousel, ArtDirection, Family, type ArtData, type CarouselData } from '../schema/index.js';
import { loadProject, opaqueId, writeJson, log, withLock } from './io.js';
import { loadConfig } from './config.js';
import { parseCopy, toCopy } from '../source/copy.js';
type Role=string;type Composition=ArtData['slides'][string]['composition'];
// First visual draft by narrative function (visual/art-direction.md). Claude revises it; the studio tweaks it.
const PLAN:Record<string,Record<Role,Composition>>={
 cinematic_condensed:{interruption:'full_bleed',conflict:'text_only',revelation:'cinematic_fade',mechanism:'cinematic_fade',contrast:'contrast',example:'cinematic_fade',escalation:'text_only',second_turn:'giant_statement',reorganization:'text_only',hammer:'giant_statement'},
 editorial_clean:{interruption:'full_bleed',conflict:'text_only',revelation:'giant_statement',mechanism:'text_only',contrast:'contrast',example:'image_card',escalation:'text_only',second_turn:'giant_statement',reorganization:'text_only',hammer:'giant_statement'},
};
const WITH_IMAGE=new Set<Composition>(['full_bleed','cinematic_fade','image_card']);
const ALTERNATE:Record<string,Composition>={text_only:'quote',cinematic_fade:'text_only',image_card:'text_only',giant_statement:'minimal_pause',contrast:'text_only',quote:'text_only',minimal_pause:'giant_statement',full_bleed:'cinematic_fade'};
export function initialDirection(family:z.infer<typeof Family>,slides:{narrative_role:string;body:string|null;visual_intent?:string}[]){
 const comps:Composition[]=slides.map((s,i)=>{
  if(i===0)return 'full_bleed';
  let c=PLAN[family][s.narrative_role]??(s.body?'text_only':'giant_statement');
  if(!s.body&&(c==='text_only'||c==='contrast'))c='giant_statement';
  if(family==='editorial_clean'&&s.narrative_role==='mechanism'&&i%3===2)c='image_card'; // an image every few mechanisms keeps rhythm
  return c;
 });
 // Never three equal compositions in a row (visual lint) — the third takes an alternate.
 for(let i=2;i<comps.length;i++)if(comps[i]===comps[i-1]&&comps[i]===comps[i-2])comps[i]=ALTERNATE[comps[i]]??'text_only';
 return comps.map((composition,i)=>{
  const s=slides[i],image=WITH_IMAGE.has(composition),cover=i===0;
  return {visual_role:s.narrative_role,composition,density:(image&&s.body?'HIGH':s.body?'MEDIUM':'LOW') as 'LOW'|'MEDIUM'|'HIGH',
   layout:{headline_position:cover?'bottom':'top',align:cover&&family==='editorial_clean'?'center':'left'} as const,
   image:{need:image,placeholder:image,concept:s.visual_intent??'',mood:'',subject_priority:'',crop:'cover',negative_space:cover?'lower third':'',strategy:image?'generated':'none',alternatives:[],focal_point:{x:.5,y:.5}} as ArtData['slides'][string]['image'],
   fit:{headline:(cover||composition==='giant_statement')?'fill':'preferred'} as const};
 });
}
const SlideMeta=z.object({id:z.string().optional(),narrative_role:z.string().optional(),headline_type:z.string().optional(),adds:z.array(z.string()).optional(),next_question:z.string().optional(),visual_intent:z.string().optional()}).strict();
export const DraftMeta=z.object({
 editorial:Carousel.shape.editorial.partial().optional(),
 art:z.object({family:Family.optional(),cover_strategy:z.string().optional(),rationale:z.string().optional()}).strict().optional(),
 slides:z.array(SlideMeta).optional(),
}).strict();
function assertEditable(c:CarouselData){if(c.project.copy_locked||c.project.mode!=='full')throw Error('Copy travada (design-only): a estrutura não muda por draft/slide. Para voz, usar voice + approve.');}
async function save(dir:string,c:CarouselData,art:ArtData,tweaks:any){
 Carousel.parse(c);ArtDirection.parse(art);
 const ids=new Set(c.slides.map(s=>s.id));
 for(const id of Object.keys(art.slides))if(!ids.has(id))delete art.slides[id];
 for(const id of Object.keys(tweaks.slides))if(!ids.has(id))delete tweaks.slides[id];
 await writeJson(path.join(dir,'carousel.json'),c);await writeJson(path.join(dir,'art-direction.json'),art);await writeJson(path.join(dir,'tweaks.json'),tweaks);
 await writeFile(path.join(dir,'copy.md'),toCopy(c.slides));
}
// Creates or replaces the slides of a full-mode project from copy.md (+ editorial metadata). A redraft keeps the IDs
// of slides that stay (explicit id in the metadata, else same position), so art direction and tweaks survive.
export function draft(dir:string,copyFile:string,metaFile?:string,options:{resetArt?:boolean}={}){return withLock(dir,async()=>{
 const p=await loadProject(dir),c=p.carousel;assertEditable(c);
 if(await readFile(path.join(dir,'variant.json')).then(()=>true,()=>false))throw Error('Draft só no projeto principal, não numa versão');
 const panels=parseCopy(await readFile(copyFile,'utf8')),meta=metaFile?DraftMeta.parse(JSON.parse(await readFile(metaFile,'utf8'))):{};
 const {slides:range}=await loadConfig();
 if(panels.length<range.min||panels.length>range.max)throw Error(`A copy precisa de ${range.min} a ${range.max} painéis (tem ${panels.length})`);
 if(meta.slides&&meta.slides.length!==panels.length)throw Error(`Metadados com ${meta.slides.length} slides para ${panels.length} painéis`);
 const known=new Set(c.slides.map(s=>s.id)),used=new Set<string>();
 const slides=panels.map((panel,i)=>{
  const m=meta.slides?.[i]??{},previous=m.id?c.slides.find(s=>s.id===m.id):c.slides[i];
  if(m.id&&!known.has(m.id))throw Error(`ID desconhecido nos metadados: ${m.id}`);
  let id=previous?.id??opaqueId();if(used.has(id))id=opaqueId();used.add(id);
  const {id:_,...fields}=m;
  return {id,narrative_role:fields.narrative_role??previous?.narrative_role??(i===0?'interruption':i===panels.length-1?'hammer':'mechanism'),headline:panel.headline,body:panel.body,
   headline_type:fields.headline_type??previous?.headline_type??'statement',adds:fields.adds??previous?.adds??[],next_question:fields.next_question??previous?.next_question??'',visual_intent:fields.visual_intent??previous?.visual_intent??''};
 });
 c.editorial={...c.editorial,...meta.editorial};c.slides=slides;
 const art=p.art;if(meta.art?.family)art.family=meta.art.family;if(meta.art?.cover_strategy)art.cover_strategy=meta.art.cover_strategy;if(meta.art?.rationale)art.rationale=meta.art.rationale;
 const fresh=initialDirection(art.family,slides);
 slides.forEach((s,i)=>{if(options.resetArt||!art.slides[s.id])art.slides[s.id]=fresh[i];});
 await save(dir,c,art,p.tweaks);
 const kept=slides.filter(s=>known.has(s.id)).length;
 await log(dir,'EDITORIAL',`Draft: ${slides.length} painéis (${kept} IDs preservados)${options.resetArt?'; direção de arte refeita':''}`);
 return {slides:slides.map((s,i)=>({position:i+1,id:s.id,headline:s.headline})),kept};
});}
export function slideAdd(dir:string,input:{headline:string;body?:string|null;role?:string;after?:string;at?:number}){return withLock(dir,async()=>{
 const p=await loadProject(dir),c=p.carousel;assertEditable(c);
 if(!input.headline.trim())throw Error('Informe --headline');
 let index=c.slides.length;
 if(input.after!==undefined){index=input.after==='0'?0:c.slides.findIndex(s=>s.id===input.after)+1;if(index===0&&input.after!=='0')throw Error('Slide --after desconhecido');}
 if(input.at!==undefined){if(!Number.isInteger(input.at)||input.at<1||input.at>c.slides.length+1)throw Error('--at fora do intervalo');index=input.at-1;}
 const slide={id:opaqueId(),narrative_role:input.role??'mechanism',headline:input.headline.trim(),body:input.body?.trim()||null,headline_type:'statement',adds:[],next_question:'',visual_intent:''};
 c.slides.splice(index,0,slide);
 p.art.slides[slide.id]=initialDirection(p.art.family,c.slides)[index];
 await save(dir,c,p.art,p.tweaks);await log(dir,'EDITORIAL',`Slide ${slide.id} adicionado na posição ${index+1}`);return {id:slide.id,position:index+1};
});}
export function slideMove(dir:string,id:string,to:number){return withLock(dir,async()=>{
 const p=await loadProject(dir),c=p.carousel;assertEditable(c);
 const from=c.slides.findIndex(s=>s.id===id);if(from<0)throw Error('Slide desconhecido');
 if(!Number.isInteger(to)||to<1||to>c.slides.length)throw Error('--to fora do intervalo');
 const [s]=c.slides.splice(from,1);c.slides.splice(to-1,0,s);
 await save(dir,c,p.art,p.tweaks);await log(dir,'EDITORIAL',`Slide ${id} movido de ${from+1} para ${to}`);return {id,from:from+1,to};
});}
export function slideRemove(dir:string,id:string){return withLock(dir,async()=>{
 const p=await loadProject(dir),c=p.carousel;assertEditable(c);
 const index=c.slides.findIndex(s=>s.id===id);if(index<0)throw Error('Slide desconhecido');
 c.slides.splice(index,1);await save(dir,c,p.art,p.tweaks);await log(dir,'EDITORIAL',`Slide ${id} removido (posição ${index+1})`);return {id,position:index+1};
});}
