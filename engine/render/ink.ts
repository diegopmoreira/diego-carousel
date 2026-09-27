import type { Page } from 'playwright';
import sharp from 'sharp';
// Ink map: the slide is redrawn with each headline line in its own color (cycling red/blue/yellow) and the body in
// green, without images or decoration. Reading the pixels tells where the ink really is — accents and cedillas
// included, which layout boxes do not show — so collisions between lines ("TODA" over "DISCUSSÃO" reading "TQDA"),
// headline/body contact and ink outside the safe area are caught before export.
export type InkReport={png?:Buffer;passed:boolean;headline_ok:boolean;line_gaps:number[];collisions:number[];min_gap_px:number;headline_body_gap:number|null;outside:number;overlap:number;errors:string[]};
const HEADLINE_COLORS=['#FF0000','#0000FF','#FFFF00'];
type Kind='r'|'b'|'y'|'g'|'overlap'|null;
function kind(r:number,g:number,b:number):Kind{
 if(r<60&&g<60&&b<60)return null;
 if(r>=60&&b>=60&&g<Math.min(r,b)/2)return 'overlap'; // red over blue
 if(g>=60&&r<g/2&&b<g/2)return 'g';
 if(r>=60&&g>=60&&b<Math.min(r,g)/2)return 'y';
 if(r>=60&&g<r/2&&b<r/2)return 'r';
 if(b>=60&&r<b/2&&g<b/2)return 'b';
 return 'overlap';
}
const lineKind=(i:number):Kind=>(['r','b','y'] as const)[i%3];
// safeX: glyph overhangs (the hook of a j, a Q tail) may pass the text margin, not the canvas edge.
export async function inkCheck(page:Page,{minGapEm=.02,headlineBodyGap=16,safeX=36}:{minGapEm?:number;headlineBodyGap?:number;safeX?:number}={}):Promise<InkReport>{
 const layout=await page.evaluate((colors)=>{
  document.body.classList.add('ink-map');
  const lines=[...document.querySelectorAll<HTMLElement>('h1 .text-line')];
  lines.forEach((l,i)=>{l.style.color=colors[i%colors.length];});
  const box=(el:Element)=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};};
  const h1=document.querySelector('h1');
  return {lines:lines.filter(l=>l.textContent!.trim()&&l.textContent!=='​').map(box),body:document.querySelector('p[data-role="body"]')?box(document.querySelector('p[data-role="body"]')!):null,
   size:h1?parseFloat(getComputedStyle(h1).fontSize):0,safeBottom:Number(document.body.dataset.safeBottom||1230)};
 },HEADLINE_COLORS);
 const png=await page.screenshot({type:'png'});
 await page.evaluate(()=>{document.body.classList.remove('ink-map');document.querySelectorAll<HTMLElement>('h1 .text-line').forEach(l=>{l.style.color='';});});
 const {data,info}=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const W=info.width,H=info.height;
 const at=(x:number,y:number)=>{const i=(y*W+x)*3;return kind(data[i],data[i+1],data[i+2]);};
 let outside=0,overlap=0;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=at(x,y);if(!k)continue;if(k==='overlap')overlap++;if(x<safeX||x>1080-safeX||y<50||y>layout.safeBottom)outside++;}
 // Column by column: the lowest ink of the upper line against the highest ink of the lower one within ±4 px.
 // A cedilla on the left and an accent on the right do not touch; the same column does.
 const columnGap=(upper:Kind,lower:Kind,top:number,middle:number,bottom:number)=>{
  const low=new Int32Array(W).fill(-1),high=new Int32Array(W).fill(H);
  for(let y=Math.max(0,Math.floor(top));y<Math.min(H,Math.ceil(middle));y++)for(let x=0;x<W;x++)if(at(x,y)===upper)low[x]=y;
  for(let y=Math.min(H,Math.ceil(bottom))-1;y>=Math.max(0,Math.floor(top));y--)for(let x=0;x<W;x++)if(at(x,y)===lower)high[x]=y;
  let min=Infinity;
  for(let x=0;x<W;x++){if(low[x]<0)continue;for(let dx=-4;dx<=4;dx++){const h=high[x+dx];if(h===undefined||h===H)continue;min=Math.min(min,h-low[x]-1);}}
  return min===Infinity?null:min;
 };
 const collisions:number[]=[];
 const errors:string[]=[],gaps:number[]=[],minGap=Math.max(2,Math.round(minGapEm*layout.size));
 for(let i=1;i<layout.lines.length;i++){
  const gap=columnGap(lineKind(i-1),lineKind(i),layout.lines[i-1].top-40,layout.lines[i].bottom,layout.lines[i].bottom+40);
  if(gap===null)continue;gaps.push(gap);
  if(gap<minGap){collisions.push(i);errors.push(`Linhas ${i} e ${i+1} do título quase se tocam (${gap}px de tinta; mínimo ${minGap}px)`);}
 }
 let headlineBody:number|null=null;
 if(layout.body&&layout.lines.length){
  const last=layout.lines.length-1;headlineBody=columnGap(lineKind(last),'g',layout.lines[last].top-40,layout.body.top+40,layout.body.bottom);
  if(headlineBody!==null&&headlineBody<headlineBodyGap)errors.push(`Título e body a ${headlineBody}px (mínimo ${headlineBodyGap}px)`);
 }
 if(overlap>20)errors.push(`Tinta sobreposta entre linhas (${overlap}px)`);
 if(outside>0)errors.push(`Tinta fora da área segura (${outside}px)`);
 const headlineOk=!errors.some(e=>e.startsWith('Linhas')||e.startsWith('Tinta sobreposta'));
 return {png,passed:!errors.length,headline_ok:headlineOk,line_gaps:gaps,collisions,min_gap_px:minGap,headline_body_gap:headlineBody,outside,overlap,errors};
}
