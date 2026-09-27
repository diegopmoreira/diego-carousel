import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { Carousel, ArtDirection, Tweaks, Assets, VERSION, IMAGE_COMPOSITIONS } from '../schema/index.js';
import { writeJson, readJson, log, withLock, projectsDir } from './io.js';
import { listVariants } from './variants.js';
import { listProjects } from '../preview/api.js';
// Brings a project written by an older engine to the current contracts: every document is re-validated (defaults
// filled in), gets the right $schema, and old layouts are pointed out. Content never changes here.
const DOCS:[string,{parse:(v:unknown)=>unknown}][]=[['carousel.json',Carousel],['art-direction.json',ArtDirection],['tweaks.json',Tweaks],['assets/manifest.json',Assets]];
async function migrateDir(dir:string,variant:boolean){
 const changed:string[]=[],notes:string[]=[];
 for(const [file,schema] of DOCS){
  if(variant&&(file==='carousel.json'||file==='assets/manifest.json'))continue;
  const full=path.join(dir,file),before=await readFile(full,'utf8').catch(()=>null);if(before===null)continue;
  const parsed=schema.parse(JSON.parse(before));await writeJson(full,parsed);
  if(await readFile(full,'utf8')!==before)changed.push(file);
 }
 const art=await readJson(path.join(dir,'art-direction.json')).catch(()=>null),tweaks=await readJson(path.join(dir,'tweaks.json')).catch(()=>null);
 if(art)for(const [id,d] of Object.entries<any>(art.slides)){
  const comp=tweaks?.slides?.[id]?.composition??d.composition;
  if(['text_only','quote','contrast'].includes(comp)&&d.layout.headline_position==='top')notes.push(`${id}: ${comp} alinhado ao topo (antes da Rodada 2 era o padrão); "center" equilibra o bloco`);
  if(!d.image.asset_id&&(d.image.need||d.image.placeholder)&&!IMAGE_COMPOSITIONS.includes(comp))notes.push(`${id}: ${comp} não mostra imagem, mas o slide exige uma: trocar a composição ou rodar image <projeto> ${id} --none`);
 }
 const review=await readJson(path.join(dir,'qa/visual-review.json')).catch(()=>null);
 if(review&&review.schema_version===1)notes.push('Revisão visual no formato antigo: será convertida na próxima revisão');
 if(changed.length)await log(dir,'MIGRATE',`Engine ${VERSION}: ${changed.join(', ')}`);
 return {dir,changed,notes};
}
export function migrate(dir:string){return withLock(dir,async()=>{
 const results=[await migrateDir(dir,false)];
 for(const v of await listVariants(dir))results.push(await migrateDir(path.join(dir,'variants',v),true));
 return results;
});}
export async function migrateAll(){return Promise.all((await listProjects()).map(p=>migrate(path.join(projectsDir(),p))));}
