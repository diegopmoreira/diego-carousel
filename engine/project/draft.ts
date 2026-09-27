import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { Carousel, ArtDirection, Family, type ArtData, type CarouselData } from '../schema/index.js';
import { loadProject, opaqueId, writeJson, log, withLock } from './io.js';
import { loadConfig } from './config.js';
import { parseCopy, toCopy, plainText } from '../source/copy.js';
import { initialDirection } from './direction.js';
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
// Which existing slide each new panel continues, so art direction and tweaks stay with their text: an explicit id in the
// metadata, then the same headline, then a close one (most words shared), and only when the panel count is unchanged,
// the same position (an in-place rewrite). A panel inserted in the middle never inherits its neighbour's image.
export function matchSlides(panels:{headline:string}[],old:{id:string;headline:string}[],explicit:(string|undefined)[]=[]){
 const words=(t:string)=>plainText(t).normalize('NFC').toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(Boolean);
 const result:(string|null)[]=panels.map((_,i)=>explicit[i]??null),used=new Set(result.filter((x):x is string=>!!x));
 panels.forEach((p,i)=>{if(result[i])return;const key=words(p.headline).join(' '),o=old.find(s=>!used.has(s.id)&&words(s.headline).join(' ')===key);if(o){result[i]=o.id;used.add(o.id);}});
 const pairs:{i:number;id:string;score:number}[]=[];
 panels.forEach((p,i)=>{if(result[i])return;const a=new Set(words(p.headline));for(const s of old){if(used.has(s.id))continue;const b=new Set(words(s.headline)),shared=[...a].filter(w=>b.has(w)).length,score=shared/new Set([...a,...b]).size;if(score>=.5)pairs.push({i,id:s.id,score});}});
 pairs.sort((x,y)=>y.score-x.score);
 for(const {i,id} of pairs){if(result[i]||used.has(id))continue;result[i]=id;used.add(id);}
 if(panels.length===old.length)panels.forEach((_,i)=>{if(!result[i]&&!used.has(old[i].id)){result[i]=old[i].id;used.add(old[i].id);}});
 return result;
}
export function draft(dir:string,copyFile:string,metaFile?:string,options:{resetArt?:boolean}={}){return withLock(dir,async()=>{
 const p=await loadProject(dir),c=p.carousel;assertEditable(c);
 if(await readFile(path.join(dir,'variant.json')).then(()=>true,()=>false))throw Error('Draft só no projeto principal, não numa versão');
 const panels=parseCopy(await readFile(copyFile,'utf8')),meta=metaFile?DraftMeta.parse(JSON.parse(await readFile(metaFile,'utf8'))):{};
 const {slides:range}=await loadConfig();
 if(panels.length<range.min||panels.length>range.max)throw Error(`A copy precisa de ${range.min} a ${range.max} painéis (tem ${panels.length})`);
 if(meta.slides&&meta.slides.length!==panels.length)throw Error(`Metadados com ${meta.slides.length} slides para ${panels.length} painéis`);
 const known=new Set(c.slides.map(s=>s.id));
 for(const m of meta.slides??[])if(m.id&&!known.has(m.id))throw Error(`ID desconhecido nos metadados: ${m.id}`);
 const ids=new Set<string>();for(const m of meta.slides??[])if(m.id){if(ids.has(m.id))throw Error(`ID repetido nos metadados: ${m.id}`);ids.add(m.id);}
 const matches=matchSlides(panels,c.slides,(meta.slides??[]).map(m=>m.id));
 const slides=panels.map((panel,i)=>{
  const m=meta.slides?.[i]??{},previous=matches[i]?c.slides.find(s=>s.id===matches[i]):undefined;
  const id=previous?.id??opaqueId();
  const {id:_,...fields}=m;
  return {id,narrative_role:fields.narrative_role??previous?.narrative_role??(i===0?'interruption':i===panels.length-1?'hammer':'mechanism'),headline:panel.headline,body:panel.body,
   headline_type:fields.headline_type??previous?.headline_type??'statement',adds:fields.adds??previous?.adds??[],next_question:fields.next_question??previous?.next_question??'',visual_intent:fields.visual_intent??previous?.visual_intent??''};
 });
 c.editorial={...c.editorial,...meta.editorial};c.slides=slides;
 const art=p.art;if(meta.art?.family)art.family=meta.art.family;if(meta.art?.cover_strategy)art.cover_strategy=meta.art.cover_strategy;if(meta.art?.rationale)art.rationale=meta.art.rationale;
 const fresh=initialDirection(art.family,slides);
 slides.forEach((s,i)=>{if(options.resetArt||!art.slides[s.id])art.slides[s.id]=fresh[i];});
 await save(dir,c,art,p.tweaks);
 const kept=slides.filter(s=>known.has(s.id)).length,removed=c.slides.length&&known.size-kept;
 await log(dir,'EDITORIAL',`Draft: ${slides.length} painéis (${kept} IDs preservados, ${slides.length-kept} novos, ${removed} removidos)${options.resetArt?'; direção de arte refeita':''}`);
 return {slides:slides.map((s,i)=>({position:i+1,id:s.id,headline:s.headline,kept:known.has(s.id)})),kept,added:slides.length-kept,removed};
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
