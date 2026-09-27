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
// The 0.1.0 parser, kept verbatim: copy locked by that version is checked against the parse it was imported with.
export function parseCopyV1(input:string):Panel[]{
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
// Every parser that ever locked copy, newest first. Locked copy is valid if one of them reproduces it.
export const COPY_PARSERS:{version:string;parse:(input:string)=>Panel[]}[]=[{version:'0.2',parse:parseCopy},{version:'0.1',parse:parseCopyV1}];
export const plainText=(text:string)=>text.replace(/\*\*(.*?)\*\*/gs,'$1');
// Explicit markers round-trip bodies with paragraphs and **emphasis** through parseCopy.
export function toCopy(panels:Panel[]){return panels.map((p,i)=>`P${i+1}\n${p.headline}${p.body?'\n'+p.body:''}`).join('\n\n')+'\n';}
// Acronyms are written in capitals by convention, not for emphasis ("O TDAH NÃO é preguiça" highlights only NÃO).
// To highlight one, mark it explicitly: **TDAH**.
const ACRONYMS=new Set(['TDAH','TOC','TEPT','TAG','TPM','TEA','QI','DNA','EUA','ONU','OMS','SUS','ONG','CEO','RH','UTI','TV','IA','PIB','CPF','CNH','ENEM','INSS','MEC','CLT','DSM','CID','LGBT','LGBTQIA']);
// Words written in CAPITALS inside mixed-case text are the author's emphasis ("Como um HOMEM escolhe uma MULHER?").
// Text that is mostly capitals is a style, not emphasis. Existing **markers** are kept as they are.
export function emphasis(text:string){
 const letters=text.replace(/\*\*/g,'').match(/\p{L}/gu)??[],upper=letters.filter(c=>c===c.toLocaleUpperCase('pt-BR')&&c!==c.toLocaleLowerCase('pt-BR')).length;
 if(!letters.length||upper/letters.length>.6)return text;
 // Each capitalised word is marked on its own, then neighbours are joined back into one run.
 return text.split(/(\*\*.*?\*\*)/s).map(part=>part.startsWith('**')?part:part.replace(/(?<![\p{L}\p{N}])\p{Lu}{2,}(?![\p{L}\p{N}])/gu,m=>ACRONYMS.has(m)?m:`**${m}**`).replace(/\*\*([ \t]+)\*\*/g,'$1')).join('');
}
// YouTube's "copy transcript" puts each time on its own line or glues it, with its spoken duration, to the text:
// "0:099 segundoscomo é…", "1:011 minuto e 1 segundoQuem…", "7:007 minutosEu…". The time stays as a [m:ss] marker
// (the Corpus working transcript has the same), so the source map can say where an idea is and a frame of the video
// can be taken there. Duration lines and the "Sincronizar com o momento do vídeo" footer go; chapter titles stay.
const DURATION='\\d+\\s+(?:horas?|minutos?|segundos?)(?:\\s+e\\s+\\d+\\s+(?:minutos?|segundos?))*';
const YT_TIME=new RegExp(`^((?:\\d{1,2}:)?\\d{1,2}:\\d{2})(?:${DURATION})?`,'i'),YT_DURATION=new RegExp(`^${DURATION}$`,'i');
export function cleanTranscript(text:string){
 const out:string[]=[];let time:string|null=null;
 for(const raw of normalizeSource(text).split('\n')){
  const line=raw.trim();
  if(!line){out.push('');continue;}
  if(YT_DURATION.test(line)||/^Sincronizar com o momento do vídeo$/i.test(line))continue;
  const m=line.match(YT_TIME);
  if(m){const rest=line.slice(m[0].length).trim();if(!rest){time=m[1];continue;}out.push(`[${m[1]}] ${rest}`);time=null;continue;}
  out.push(time?`[${time}] ${line}`:line);time=null;
 }
 return out.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
