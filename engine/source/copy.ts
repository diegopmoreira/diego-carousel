export type Panel = {headline:string;body:string|null};
export function normalizeSource(text:string){return text.normalize('NFC').replace(/\r\n?/g,'\n');}
export function parseCopy(input:string):Panel[]{
 const text=normalizeSource(input).trim();
 if(!text)throw Error('Copy vazia');
 const marker=/^\s*(?:P|Slide\s+)(\d+)\s*(?:[:.\-–—]\s*(.*))?\s*$/gim;
 const matches=[...text.matchAll(marker)];
 let blocks:string[];
 if(matches.length){
  if(text.slice(0,matches[0].index).trim())throw Error('Texto antes do primeiro painel');
  matches.forEach((m,i)=>{if(Number(m[1])!==i+1)throw Error('Painéis devem começar em P1 e seguir sem lacunas');});
  blocks=matches.map((m,i)=>[m[2]??'',text.slice(m.index!+m[0].length,matches[i+1]?.index??text.length)].filter(Boolean).join('\n').trim());
 }else blocks=text.split(/\n[ \t]*\n+/);
 return blocks.map((b,i)=>{const [headline,...body]=b.trim().split('\n');if(!headline?.trim())throw Error(`Painel ${i+1} sem headline`);return {headline:headline.trim(),body:body.join('\n').trim()||null};});
}
export const plainText=(text:string)=>text.replace(/\*\*(.*?)\*\*/gs,'$1');
export function toCopy(panels:Panel[]){return panels.map(p=>p.headline+(p.body?'\n'+p.body:'')).join('\n\n')+'\n';}
export function cleanTranscript(text:string){return normalizeSource(text).split('\n').filter(l=>!/^\s*(?:(?:\d{1,2}:)?\d{1,2}:\d{2}|\d+\s+segundos?)\s*$/i.test(l)).join('\n').trim();}
