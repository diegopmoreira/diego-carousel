import path from 'node:path';
import { rm, mkdir, readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { contentDir, loadProject, readJson, writeJson, escapeXml } from '../project/io.js';
import { createVariant } from '../project/variants.js';
import { render } from './render.js';
// The slide rendered with each of its images (current + alternatives) and the real headline, side by side,
// so Claude (or Diego) scores composition, legibility, room for text, coherence, novelty and identity.
export async function candidates(dir:string,slide:string){
 const base=await contentDir(dir),p=await loadProject(dir),d=p.art.slides[slide];
 if(!d)throw Error('Slide desconhecido');
 const ids=[d.image.asset_id,...d.image.alternatives].filter((x):x is string=>!!x);
 if(ids.length<2)throw Error('O slide tem menos de duas imagens para comparar');
 const index=p.carousel.slides.findIndex(s=>s.id===slide),num=String(index+1).padStart(2,'0');
 const tiles:Buffer[]=[];
 for(const [k,id] of ids.entries()){
  const name=`candidata-${k+1}-${randomBytes(3).toString('hex')}`,variant=await createVariant(base,name);
  try{
   const art=await readJson(path.join(variant,'art-direction.json'));art.slides[slide].image.asset_id=id;art.slides[slide].image.placeholder=false;
   await writeJson(path.join(variant,'art-direction.json'),art);
   const manifest=await render(variant,[slide]),record=manifest.slides.find((r:any)=>r.id===slide);
   const asset=p.assets.assets.find(a=>a.id===id)!;
   const label=`${k===0?'atual':'alternativa'} · ${id}${asset.score!==undefined?` · nota ${asset.score}`:''}${record?.passed?'':' · FALHA'}`;
   const png=await sharp(await readFile(path.join(variant,`qa/render/${num}.png`))).resize(432,540).toBuffer();
   const bar=Buffer.from(`<svg width="432" height="44" xmlns="http://www.w3.org/2000/svg"><rect width="432" height="44" fill="#1b1b1b"/><text x="14" y="28" font-family="sans-serif" font-size="17" fill="#ddd">${escapeXml(label)}</text></svg>`);
   tiles.push(await sharp({create:{width:432,height:584,channels:3,background:'#1b1b1b'}}).composite([{input:png,left:0,top:0},{input:bar,left:0,top:540}]).png().toBuffer());
  }finally{await rm(variant,{recursive:true,force:true});}
 }
 await mkdir(path.join(base,'qa/candidates'),{recursive:true});
 const out=path.join(base,`qa/candidates/${slide}.png`),gap=16;
 await sharp({create:{width:ids.length*(432+gap)+gap,height:584+2*gap,channels:3,background:'#0b0b0b'}}).composite(tiles.map((input,i)=>({input,left:gap+i*(432+gap),top:gap}))).png().toFile(out);
 return {slide,images:ids,sheet:out};
}
