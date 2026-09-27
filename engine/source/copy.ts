export type Panel = {headline:string;body:string|null};
export function normalizeSource(text:string){return text.normalize('NFC').replace(/\r\n?/g,'\n');}
// "P1", "P1: Título", "P1 Título", "Slide 1 — Título". The number must end the token, so "P2P" is text.
const MARKER=/^[ \t]*(?:P|Slide[ \t]+)(\d+)(?![\p{L}\p{N}])[ \t]*(?:[:.\-–—][ \t]*)?(.*?)[ \t]*$/gimu;
export function parseCopy(input:string):Panel[]{
 const text=normalizeSource(input).trim();
 if(!text)throw Error('Copy vazia');
 const matches=[...text.matchAll(MARKER)];
 let blocks:string[];
 if(matches.length){
  if(text.slice(0,matches[0].index).trim())throw Error('Texto antes do primeiro painel');
  matches.forEach((m,i)=>{if(Number(m[1])!==i+1)throw Error('Painéis devem começar em P1 e seguir sem lacunas');});
  blocks=matches.map((m,i)=>[m[2]??'',text.slice(m.index!+m[0].length,matches[i+1]?.index??text.length)].filter(Boolean).join('\n').trim());
 }else{
  // Figma blocks: panels are separated by a blank line. When any gap has two or more blank lines,
  // those gaps separate panels and single blank lines are paragraphs inside a body.
  blocks=/\n[ \t]*\n[ \t]*\n/.test(text)?text.split(/\n(?:[ \t]*\n){2,}/):text.split(/\n[ \t]*\n+/);
 }
 return blocks.map((b,i)=>{const [headline,...body]=b.trim().split('\n');if(!headline?.trim())throw Error(`Painel ${i+1} sem headline`);return {headline:headline.trim(),body:body.join('\n').trim()||null};});
}
export const plainText=(text:string)=>text.replace(/\*\*(.*?)\*\*/gs,'$1');
// Explicit markers round-trip bodies with paragraphs and **emphasis** through parseCopy.
export function toCopy(panels:Panel[]){return panels.map((p,i)=>`P${i+1}\n${p.headline}${p.body?'\n'+p.body:''}`).join('\n\n')+'\n';}
// Words written in CAPITALS inside mixed-case text are the author's emphasis ("Como um HOMEM escolhe uma MULHER?").
// Text that is mostly capitals is a style, not emphasis. Existing **markers** are kept as they are.
export function emphasis(text:string){
 const letters=text.replace(/\*\*/g,'').match(/\p{L}/gu)??[],upper=letters.filter(c=>c===c.toLocaleUpperCase('pt-BR')&&c!==c.toLocaleLowerCase('pt-BR')).length;
 if(!letters.length||upper/letters.length>.6)return text;
 return text.split(/(\*\*.*?\*\*)/s).map(part=>part.startsWith('**')?part:part.replace(/(?<![\p{L}\p{N}])\p{Lu}{2,}(?:[ \t]+\p{Lu}{2,})*(?![\p{L}\p{N}])/gu,m=>`**${m}**`)).join('');
}
export function cleanTranscript(text:string){return normalizeSource(text).split('\n').filter(l=>!/^\s*(?:(?:\d{1,2}:)?\d{1,2}:\d{2}|\d+\s+segundos?)\s*$/i.test(l)).join('\n').trim();}
