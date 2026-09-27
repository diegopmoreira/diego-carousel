import { z } from 'zod';
import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { ArtDirection, Family, Composition, Tweaks } from '../schema/index.js';
import { ROOT, contentDir, loadProject, jsonHash, writeJson, optionalJson, log } from '../project/io.js';
import { listVariants } from '../project/variants.js';
export async function revision(dir:string){const p=await loadProject(dir);return jsonHash(p);}
export const Adjustment=z.object({revision:z.string(),id:z.string(),family:Family.optional(),composition:Composition.optional(),align:z.enum(['left','center']).optional(),position:z.enum(['top','center','bottom']).optional(),fit:z.enum(['fill','preferred']).optional(),asset_id:z.string().nullable().optional(),focal_x:z.number().min(0).max(1).optional(),focal_y:z.number().min(0).max(1).optional(),params:Tweaks.shape.slides.valueType.shape.params.optional()}).strict();
export async function adjust(dir:string,input:unknown){
 const patch=Adjustment.parse(input),p=await loadProject(dir);
 if(jsonHash(p)!==patch.revision)throw Error('O projeto mudou. Recarrega antes de salvar.');
 const d=p.art.slides[patch.id];if(!d)throw Error('Slide desconhecido');
 if(patch.family)p.art.family=patch.family;
 if(patch.composition){d.composition=patch.composition;if(p.tweaks.slides[patch.id])delete p.tweaks.slides[patch.id].composition;}
 if(patch.align)d.layout.align=patch.align;if(patch.position)d.layout.headline_position=patch.position;if(patch.fit)d.fit.headline=patch.fit;
 if(patch.asset_id!==undefined){if(patch.asset_id&&!p.assets.assets.some(x=>x.id===patch.asset_id))throw Error('Imagem desconhecida');d.image.asset_id=patch.asset_id??undefined;d.image.need=!!patch.asset_id;d.image.placeholder=false;}
 if(patch.focal_x!==undefined)d.image.focal_point.x=patch.focal_x;if(patch.focal_y!==undefined)d.image.focal_point.y=patch.focal_y;
 const comp=p.tweaks.slides[patch.id]?.composition??d.composition;
 if(d.image.asset_id&&!['full_bleed','cinematic_fade','image_card'].includes(comp))throw Error('Essa composição não possui imagem. Escolhe uma composição com imagem ou remove a imagem do slide.');
 if(patch.params)p.tweaks.slides[patch.id]={...p.tweaks.slides[patch.id],params:{...p.tweaks.slides[patch.id]?.params,...patch.params}};
 ArtDirection.parse(p.art);Tweaks.parse(p.tweaks);
 await writeJson(path.join(dir,'art-direction.json'),p.art);await writeJson(path.join(dir,'tweaks.json'),p.tweaks);await log(dir,'ADJUST',`Ajustes salvos para ${patch.id}`);
}
export async function state(dir:string){
 const p=await loadProject(dir),manifest=await optionalJson(path.join(dir,'render-manifest.json')),review=await optionalJson(path.join(dir,'qa/visual-review.json'));
 const {renderInputs}=await import('../render/render.js');const current=await renderInputs(dir);
 const projects=(await readdir(path.join(ROOT,'projects'),{withFileTypes:true}).catch(()=>[])).filter(e=>e.isDirectory()&&/^[a-z0-9-]+$/.test(e.name)).map(e=>e.name).sort().reverse();
 return {projects,project_name:path.basename(await contentDir(dir)),revision:jsonHash(p),title:p.carousel.source.title,...p,variants:await listVariants(dir),active_variant:path.basename(path.dirname(dir))==='variants'?path.basename(dir):null,render_current:manifest?.project_hash===current.project_hash,review_current:!!review?.approved&&review.render_hash===manifest?.render_hash&&manifest?.project_hash===current.project_hash,manifest,fits:Object.fromEntries(await Promise.all(p.carousel.slides.map(async s=>[s.id,await optionalJson(path.join(dir,`fit/${s.id}.json`))]))),lint:await optionalJson(path.join(dir,'qa/editorial-lint.json'))};
}
