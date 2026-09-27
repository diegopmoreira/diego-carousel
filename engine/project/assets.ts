import sharp from 'sharp';
import path from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { contentDir, loadProject, opaqueId, hash, writeJson } from './io.js';
import { Assets, IMAGE_COMPOSITIONS, type AssetsData } from '../schema/index.js';
const MAX_PIXELS=60_000_000;
type Asset=AssetsData['assets'][number];
export type AssetOptions=Partial<Pick<Asset,'origin'|'provider'|'model'|'request'|'prompt'|'negative'|'seed'|'params'|'request_id'|'source_url'|'score'|'rationale'|'credit'>>&{alternative?:boolean};
// Registers an image with provenance. With a slide: becomes its image (the previous one is kept as an alternative),
// or only an alternative when `alternative` is set. Never switches the slide's composition.
export async function addAsset(dir:string,bytes:Buffer,rights:string,slide?:string,options:AssetOptions={}){
 if(!rights.trim())throw Error('Informe a origem e os direitos da imagem');
 if(bytes.length>20*1024*1024)throw Error('Imagem maior que 20 MB');
 const base=await contentDir(dir),p=await loadProject(dir);
 if(slide&&!p.art.slides[slide])throw Error('Slide desconhecido');
 const meta=await sharp(bytes,{limitInputPixels:MAX_PIXELS}).metadata();
 if(!['png','jpeg','webp'].includes(meta.format??''))throw Error('Use PNG, JPEG ou WebP');
 const processed=await sharp(bytes,{limitInputPixels:MAX_PIXELS}).rotate().resize({width:2160,height:2700,fit:'inside',withoutEnlargement:true}).png().toBuffer();
 const size=await sharp(processed).metadata(),id=opaqueId(),relative=`assets/processed/${id}.png`;
 await mkdir(path.join(base,'assets/processed'),{recursive:true});await mkdir(path.join(base,'assets/source'),{recursive:true});
 await writeFile(path.join(base,relative),processed);await writeFile(path.join(base,`assets/source/${id}.${meta.format}`),bytes);
 const {alternative,...fields}=options;
 p.assets.assets.push({id,file:relative,sha256:hash(processed),origin:'user',rights,provider:'manual',created_at:new Date().toISOString(),credit:'',width:size.width!,height:size.height!,used_by:[],...fields});
 let attached=false,warning:string|undefined;
 if(slide){
  const d=p.art.slides[slide],comp=p.tweaks.slides[slide]?.composition??d.composition;
  if(alternative&&d.image.asset_id){d.image.alternatives=[...new Set([...d.image.alternatives,id])];}
  else if(IMAGE_COMPOSITIONS.includes(comp)){
   const previous=d.image.asset_id;
   d.image={...d.image,placeholder:false,asset_id:id,strategy:fields.origin==='generated'?'generated':d.image.strategy==='none'?'manual':d.image.strategy,alternatives:[...new Set([...d.image.alternatives,...(previous?[previous]:[])])].filter(a=>a!==id)};
   attached=true;
  }else{d.image.alternatives=[...new Set([...d.image.alternatives,id])];warning=`Imagem guardada como alternativa: a composição ${comp} não tem imagem. Escolhe ${IMAGE_COMPOSITIONS.join(', ')} e seleciona a imagem.`;}
  await writeJson(path.join(dir,'art-direction.json'),p.art);
 }
 if(attached)p.assets.assets.at(-1)!.used_by.push(slide!);
 await writeJson(path.join(base,'assets/manifest.json'),Assets.parse(p.assets));
 return {id,attached,warning};
}
// Makes one of the slide's alternatives (or any registered image) its current image; the previous one stays an alternative.
export async function chooseAsset(dir:string,slide:string,assetId:string,{score,rationale}:{score?:number;rationale?:string}={}){
 const base=await contentDir(dir),p=await loadProject(dir),d=p.art.slides[slide];
 if(!d)throw Error('Slide desconhecido');
 const asset=p.assets.assets.find(a=>a.id===assetId);if(!asset)throw Error('Imagem desconhecida');
 const comp=p.tweaks.slides[slide]?.composition??d.composition;
 if(!IMAGE_COMPOSITIONS.includes(comp))throw Error(`A composição ${comp} não tem imagem`);
 const previous=d.image.asset_id;
 d.image={...d.image,asset_id:assetId,placeholder:false,alternatives:[...new Set([...d.image.alternatives,...(previous?[previous]:[])])].filter(a=>a!==assetId)};
 for(const a of p.assets.assets){a.used_by=a.used_by.filter(s=>s!==slide);}
 asset.used_by.push(slide);if(score!==undefined)asset.score=score;if(rationale)asset.rationale=rationale;
 await writeJson(path.join(dir,'art-direction.json'),p.art);await writeJson(path.join(base,'assets/manifest.json'),Assets.parse(p.assets));
 return {slide,asset:assetId,previous:previous??null};
}
