import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, readFile, rm, copyFile } from 'node:fs/promises';
import sharp from 'sharp';
import { ROOT, readJson, writeJson, hash } from '../project/io.js';
import { importCopy } from '../project/create.js';
import { addAsset } from '../project/assets.js';
import { render } from './render.js';
// Every composition × family on one sheet, for visual review of the vocabulary (gallery/ is not versioned).
const COMPOSITIONS=['full_bleed','cinematic_fade','image_card','text_only','giant_statement','minimal_pause','quote','contrast','text_only','giant_statement'] as const;
export async function gallery({out=path.join(ROOT,'gallery'),image}:{out?:string;image?:string}={}){
 const work=await mkdtemp(path.join(os.tmpdir(),'gallery-'));
 try{
  await mkdir(out,{recursive:true});
  const sheets:{family:string;file:string}[]=[];
  for(const family of ['editorial_clean','cinematic_condensed']){
   const dir=path.join(work,family);
   for(const d of ['source','qa','assets'])await mkdir(path.join(dir,d),{recursive:true});
   const c=await readJson(path.join(ROOT,'engine/schema/examples/carousel.json'));c.slides=[];c.source.hash=hash('');
   await writeJson(path.join(dir,'carousel.json'),c);await writeJson(path.join(dir,'tweaks.json'),{schema_version:1,slides:{}});await writeJson(path.join(dir,'assets/manifest.json'),{schema_version:1,assets:[]});
   await importCopy(dir,path.join(ROOT,'fixtures/copy-gallery.md'));
   const a=await readJson(path.join(dir,'art-direction.json')),carousel=await readJson(path.join(dir,'carousel.json'));a.family=family;
   carousel.slides.forEach((s:any,i:number)=>{const d=a.slides[s.id];d.composition=COMPOSITIONS[i];const img=['full_bleed','cinematic_fade','image_card'].includes(COMPOSITIONS[i]);d.image={...d.image,need:img,placeholder:img,concept:img?'cena de exemplo':''};d.layout.headline_position=i===0?'bottom':img?'top':'center';d.fit.headline=i===0||COMPOSITIONS[i]==='giant_statement'?'fill':'preferred';});
   await writeJson(path.join(dir,'art-direction.json'),a);
   if(image)for(const s of carousel.slides.slice(0,3))await addAsset(dir,await readFile(image),'Imagem de teste da galeria',s.id);
   const manifest=await render(dir);
   const file=path.join(out,`${family}.png`);await copyFile(path.join(dir,'qa/contact-sheet.png'),file);
   sheets.push({family,file});
   for(const r of manifest.slides)if(!r.passed)console.error(`${family} P${r.position}: ${r.errors.join('; ')}`);
  }
  const images=await Promise.all(sheets.map(s=>sharp(s.file).toBuffer({resolveWithObject:true})));
  const width=Math.max(...images.map(i=>i.info.width)),height=images.reduce((h,i)=>h+i.info.height,0);
  let top=0;const composite=images.map(i=>{const r={input:i.data,left:0,top};top+=i.info.height;return r;});
  const all=path.join(out,'gallery.png');await sharp({create:{width,height,channels:3,background:'#292929'}}).composite(composite).png().toFile(all);
  return {sheets:[...sheets.map(s=>s.file),all]};
 }finally{await rm(work,{recursive:true,force:true});}
}
