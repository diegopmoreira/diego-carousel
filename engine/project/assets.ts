import sharp from 'sharp';
import path from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { contentDir, loadProject, opaqueId, hash, writeJson } from './io.js';
import { Assets } from '../schema/index.js';
export async function addAsset(dir:string,bytes:Buffer,rights:string,slide?:string){
 if(!rights.trim())throw Error('Informe a origem e os direitos da imagem');
 if(bytes.length>20*1024*1024)throw Error('Imagem maior que 20 MB');
 const base=await contentDir(dir),p=await loadProject(dir);
 if(slide&&!p.art.slides[slide])throw Error('Slide desconhecido');
 const meta=await sharp(bytes,{limitInputPixels:60_000_000}).metadata();
 if(!['png','jpeg','webp'].includes(meta.format??''))throw Error('Use PNG, JPEG ou WebP');
 const processed=await sharp(bytes).rotate().resize({width:2160,height:2700,fit:'inside',withoutEnlargement:true}).png().toBuffer();
 const size=await sharp(processed).metadata(),id=opaqueId(),relative=`assets/processed/${id}.png`;
 await mkdir(path.join(base,'assets/processed'),{recursive:true});await mkdir(path.join(base,'assets/source'),{recursive:true});
 await writeFile(path.join(base,relative),processed);await writeFile(path.join(base,`assets/source/${id}.${meta.format}`),bytes);
 p.assets.assets.push({id,file:relative,sha256:hash(processed),origin:'user',rights,provider:'manual',created_at:new Date().toISOString(),credit:'',width:size.width!,height:size.height!,used_by:slide?[slide]:[]});
 await writeJson(path.join(base,'assets/manifest.json'),Assets.parse(p.assets));
 if(slide){const d=p.art.slides[slide];d.image={...d.image,need:true,placeholder:false,asset_id:id,strategy:'manual'};if(!['full_bleed','cinematic_fade','image_card'].includes(p.tweaks.slides[slide]?.composition??d.composition)){d.composition='image_card';if(p.tweaks.slides[slide])delete p.tweaks.slides[slide].composition;}await writeJson(path.join(dir,'art-direction.json'),p.art);await writeJson(path.join(dir,'tweaks.json'),p.tweaks);}
 return id;
}
