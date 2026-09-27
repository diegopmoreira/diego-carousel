import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
// Render × published slide, for tuning tokens (Rodada 2). Replaces `magick compare` without an extra dependency:
// mean absolute error, share of pixels that differ visibly, and a sheet reference | render | difference.
export async function calibrate(dir:string,position:number,reference:string,{threshold=32}={}){
 const num=String(position).padStart(2,'0'),render=path.join(dir,`qa/render/${num}.png`);
 const load=(f:string)=>sharp(f).resize(1080,1350,{fit:'fill'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const [a,b]=await Promise.all([load(reference),load(render)]);
 const diff=Buffer.alloc(a.data.length);let sum=0,visible=0;const n=1080*1350;
 // Rows with a visible difference, to point at the region that drifts (headline, body, footer).
 const rows=new Uint32Array(1350);
 for(let p=0;p<n;p++){
  let d=0;for(let c=0;c<3;c++)d=Math.max(d,Math.abs(a.data[p*3+c]-b.data[p*3+c]));
  sum+=d;if(d>threshold){visible++;rows[Math.floor(p/1080)]++;}
  const v=Math.min(255,d*3);diff[p*3]=v;diff[p*3+1]=v>96?v:0;diff[p*3+2]=0;
 }
 const bands:{from:number;to:number;pixels:number}[]=[];
 for(let y=0;y<1350;y++){if(rows[y]<20)continue;const last=bands.at(-1);if(last&&y-last.to<=12){last.to=y;last.pixels+=rows[y];}else bands.push({from:y,to:y,pixels:rows[y]});}
 await mkdir(path.join(dir,'qa/calibrate'),{recursive:true});
 const out=path.join(dir,`qa/calibrate/${num}.png`),tile=(buf:Buffer)=>sharp(buf,{raw:{width:1080,height:1350,channels:3}}).resize(540,675).png().toBuffer();
 const [ta,tb,td]=await Promise.all([tile(a.data),tile(b.data),tile(diff)]);
 await sharp({create:{width:1620,height:675,channels:3,background:'#000'}}).composite([{input:ta,left:0,top:0},{input:tb,left:540,top:0},{input:td,left:1080,top:0}]).png().toFile(out);
 return {slide:position,mean_abs_error:Math.round(sum/n*100)/100,visible_diff_pct:Math.round(visible/n*10000)/100,threshold,bands:bands.filter(b=>b.pixels>200).map(b=>({y:`${b.from}–${b.to}`,pixels:b.pixels})),sheet:out};
}
