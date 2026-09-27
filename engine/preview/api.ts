import { z } from 'zod';
import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { ArtDirection, Family, Composition, Tweaks, Assets, IMAGE_COMPOSITIONS } from '../schema/index.js';
import { ROOT, readJson, projectsDir, contentDir, loadProject, jsonHash, writeJson, optionalJson, log } from '../project/io.js';
import { listVariants } from '../project/variants.js';
import { loadConfig } from '../project/config.js';
import { pendingProposals } from '../qa/voice.js';
export async function revision(dir:string){const p=await loadProject(dir);return jsonHash(p);}
export const Adjustment=z.object({revision:z.string(),id:z.string(),family:Family.optional(),composition:Composition.optional(),align:z.enum(['left','center']).optional(),position:z.enum(['top','center','bottom']).optional(),fit:z.enum(['fill','preferred']).optional(),asset_id:z.string().nullable().optional(),image_need:z.boolean().optional(),focal_x:z.number().min(0).max(1).optional(),focal_y:z.number().min(0).max(1).optional(),params:Tweaks.shape.slides.valueType.shape.params.optional()}).strict();
// Patch semantics: only fields present in the request change. The studio sends the fields the user touched.
export async function adjust(dir:string,input:unknown){
 const patch=Adjustment.parse(input),p=await loadProject(dir);
 if(jsonHash(p)!==patch.revision)throw Error('O projeto mudou. Recarrega antes de salvar.');
 const d=p.art.slides[patch.id];if(!d)throw Error('Slide desconhecido');
 const art=JSON.stringify(p.art),tweaks=JSON.stringify(p.tweaks);
 const tweak=()=>p.tweaks.slides[patch.id]??={params:{}};
 if(patch.family)p.art.family=patch.family;
 // A composition chosen in the studio is a tweak over the art direction, which keeps Claude's decision.
 if(patch.composition){if(patch.composition===d.composition){if(p.tweaks.slides[patch.id])delete p.tweaks.slides[patch.id].composition;}else tweak().composition=patch.composition;}
 if(patch.align)d.layout.align=patch.align;if(patch.position)d.layout.headline_position=patch.position;if(patch.fit)d.fit.headline=patch.fit;
 if(patch.asset_id!==undefined){
  if(patch.asset_id&&!p.assets.assets.some(x=>x.id===patch.asset_id))throw Error('Imagem desconhecida');
  // Removing the image never removes the requirement: a needed image falls back to a declared placeholder.
  // Choosing another image keeps the previous one among the slide's alternatives.
  const previous=d.image.asset_id;
  if(patch.asset_id){d.image.asset_id=patch.asset_id;d.image.placeholder=false;d.image.alternatives=[...new Set([...d.image.alternatives,...(previous?[previous]:[])])].filter(a=>a!==patch.asset_id);}else{delete d.image.asset_id;d.image.placeholder=d.image.need;if(previous)d.image.alternatives=[...new Set([...d.image.alternatives,previous])];}
 }
 // Explicit decision about the slide: it requires an image (export waits) or it does not use one.
 if(patch.image_need!==undefined){d.image.need=patch.image_need;if(!d.image.asset_id){d.image.placeholder=patch.image_need;if(!patch.image_need)d.image.strategy='none';}}
 if(patch.focal_x!==undefined)d.image.focal_point.x=patch.focal_x;if(patch.focal_y!==undefined)d.image.focal_point.y=patch.focal_y;
 const comp=p.tweaks.slides[patch.id]?.composition??d.composition;
 if(d.image.asset_id&&!IMAGE_COMPOSITIONS.includes(comp))throw Error('Essa composição não possui imagem. Escolhe uma composição com imagem ou remove a imagem do slide.');
 if(!d.image.asset_id&&!d.image.placeholder&&(comp==='cinematic_fade'||comp==='image_card'))throw Error('Essa composição precisa de imagem: escolhe uma imagem, marca "Exige imagem" ou troca para uma composição de texto (CLI: composition <projeto> <slide> text_only).');
 if(!d.image.asset_id&&(d.image.need||d.image.placeholder)&&!IMAGE_COMPOSITIONS.includes(comp))throw Error('Essa composição não mostra imagem, mas o slide exige uma: desmarca "Exige imagem" (CLI: image --none) ou escolhe uma composição com imagem.');
 if(patch.params)tweak().params={...p.tweaks.slides[patch.id]?.params,...patch.params};
 const current=p.tweaks.slides[patch.id];if(current&&!current.composition&&!Object.keys(current.params).length)delete p.tweaks.slides[patch.id];
 ArtDirection.parse(p.art);Tweaks.parse(p.tweaks);
 // The manifest's used_by follows the slide's current image (shared with variants: only the main project writes it).
 let manifestChanged=false;
 if(patch.asset_id!==undefined&&!await optionalJson(path.join(dir,'variant.json'))){for(const a of p.assets.assets){const before=a.used_by.join();a.used_by=a.used_by.filter(x=>x!==patch.id);if(a.id===d.image.asset_id)a.used_by.push(patch.id);if(a.used_by.join()!==before)manifestChanged=true;}}
 if(manifestChanged)await writeJson(path.join(await contentDir(dir),'assets/manifest.json'),Assets.parse(p.assets));
 const changed=[JSON.stringify(p.art)!==art&&'art-direction.json',JSON.stringify(p.tweaks)!==tweaks&&'tweaks.json'].filter(Boolean);
 if(changed.includes('art-direction.json'))await writeJson(path.join(dir,'art-direction.json'),p.art);
 if(changed.includes('tweaks.json'))await writeJson(path.join(dir,'tweaks.json'),p.tweaks);
 await log(dir,'ADJUST',`${patch.id}: ${changed.length?changed.join(', '):'nada mudou'}`);
 return changed;
}
export async function listProjects(){return (await readdir(projectsDir(),{withFileTypes:true}).catch(()=>[])).filter(e=>e.isDirectory()&&/^[a-z0-9-]+$/.test(e.name)).map(e=>e.name).sort().reverse();}
// With no project yet the studio still opens, so the first carousel can be created from the screen.
export async function emptyState(){return {empty:true,projects:await listProjects()};}
export async function state(dir:string){
 const p=await loadProject(dir),manifest=await optionalJson(path.join(dir,'render-manifest.json')),review=await optionalJson(path.join(dir,'qa/visual-review.json'));
 const {renderInputs}=await import('../render/render.js');const current=await renderInputs(dir);
 const projects=await listProjects();
 // Proposals waiting for Diego (voice, edit), shown in the studio with an approve button.
 const base=await contentDir(dir),pending=await pendingProposals(base,p.carousel.slides.map(({headline,body})=>({headline,body})));
 // Default gap per family (the slider starts from what the slide really uses when there is no tweak).
 const tokens=await readJson(path.join(ROOT,'design/tokens.json')),family_gaps=Object.fromEntries(Object.entries<any>(tokens.families).map(([k,v])=>[k,v.gap]));
 return {pending,family_gaps,image_compositions:IMAGE_COMPOSITIONS,projects,handle:(await loadConfig()).branding.handle,project_name:path.basename(await contentDir(dir)),revision:jsonHash(p),title:p.carousel.source.title,...p,variants:await listVariants(dir),active_variant:path.basename(path.dirname(dir))==='variants'?path.basename(dir):null,render_current:manifest?.project_hash===current.project_hash,review_current:!!review?.approved&&review.render_hash===manifest?.render_hash&&manifest?.project_hash===current.project_hash,manifest,fits:Object.fromEntries(await Promise.all(p.carousel.slides.map(async s=>[s.id,await optionalJson(path.join(dir,`fit/${s.id}.json`))]))),lint:await optionalJson(path.join(dir,'qa/editorial-lint.json'))};
}
