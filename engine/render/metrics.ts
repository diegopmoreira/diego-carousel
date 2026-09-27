import type { Page } from 'playwright';
import sharp from 'sharp';
// Measured legibility and balance, reported as review warnings (visual/visual-qa.md).
const channel=(v:number)=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);};
const luminance=(r:number,g:number,b:number)=>.2126*channel(r)+.7152*channel(g)+.0722*channel(b);
export const contrastRatio=(a:number,b:number)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
export type SlideMetrics={contrast:{role:string;ratio:number;minimum:number}[];empty_band_pct:number;warnings:string[]};
// Contrast: the slide without text; the brightest 5% of the background under each block against the text color.
// Empty band: the tallest run of rows with no text ink, from the ink map.
export async function slideMetrics(page:Page,inkPng:Buffer|undefined,composition:string):Promise<SlideMetrics>{
 const blocks=await page.evaluate(()=>{
  document.body.classList.add('no-text');
  return [...document.querySelectorAll<HTMLElement>('[data-role]')].map(el=>{const r=el.getBoundingClientRect(),c=getComputedStyle(el).color.match(/\d+/g)!.map(Number);return {role:el.dataset.role!,x:Math.max(0,Math.floor(r.left)),y:Math.max(0,Math.floor(r.top)),w:Math.ceil(r.width),h:Math.ceil(r.height),color:c.slice(0,3)};});
 });
 const png=await page.screenshot({type:'png'});await page.evaluate(()=>document.body.classList.remove('no-text'));
 const {data,info}=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const warnings:string[]=[],contrast=[];
 for(const b of blocks){
  const values:number[]=[];
  for(let y=b.y;y<Math.min(info.height,b.y+b.h);y+=2)for(let x=b.x;x<Math.min(info.width,b.x+b.w);x+=2){const i=(y*info.width+x)*3;values.push(luminance(data[i],data[i+1],data[i+2]));}
  if(!values.length)continue;values.sort((a,c)=>a-c);
  const background=values[Math.floor(values.length*.95)],text=luminance(...(b.color as [number,number,number]));
  const ratio=Math.round(contrastRatio(text,background)*10)/10,minimum=b.role==='headline'?3:4.5;
  contrast.push({role:b.role,ratio,minimum});
  if(ratio<minimum)warnings.push(`Contraste do ${b.role==='headline'?'título':'body'} ${ratio}:1 (mínimo ${minimum}:1): escurecer a imagem sob o texto, mover o foco ou trocar a imagem`);
 }
 let empty=0;
 if(inkPng){
  const ink=await sharp(inkPng).removeAlpha().raw().toBuffer({resolveWithObject:true}),W=ink.info.width;let run=0;
  for(let y=110;y<1200;y++){let any=false;for(let x=0;x<W;x+=3){const i=(y*W+x)*3;if(ink.data[i]>60||ink.data[i+1]>60||ink.data[i+2]>60){any=true;break;}}run=any?0:run+1;empty=Math.max(empty,run);}
 }
 const emptyPct=Math.round(empty/1350*100);
 if(['text_only','quote','contrast'].includes(composition)&&emptyPct>50)warnings.push(`Espaço vazio de ${emptyPct}% da altura: conferir se o bloco está equilibrado ou se a composição é a certa`);
 return {contrast,empty_band_pct:emptyPct,warnings};
}
// Carousel rhythm: the same layout over and over reads as a template.
export function rhythmWarnings(compositions:string[],densities:string[]){
 const warnings:string[]=[],counts=new Map<string,number>();
 for(const c of compositions)counts.set(c,(counts.get(c)??0)+1);
 const [top,count]=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0]??['',0];
 if(counts.size<3&&compositions.length>=8)warnings.push(`Só ${counts.size} composições diferentes em ${compositions.length} painéis`);
 if(count/compositions.length>.5)warnings.push(`${top} em ${count} de ${compositions.length} painéis`);
 if(new Set(densities).size===1&&densities.length>=8)warnings.push(`Todos os painéis com densidade ${densities[0]}`);
 return warnings;
}
