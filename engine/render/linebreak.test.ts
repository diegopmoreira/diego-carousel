import { describe, it, expect, beforeAll } from 'vitest';
type Break=(text:string,measure:(t:string)=>number,width:number,options?:{balance?:boolean})=>string[];
let breakText:Break;
const mono=(t:string)=>t.length*10; // 10 px per character keeps the expectations readable
beforeAll(async()=>{await import('../../design/runtime/linebreak.js');breakText=globalThis.__breakText;});
describe('quebra de linha',()=>{
 it('não deixa uma palavra sozinha na última linha',()=>{
  const lines=breakText('Tu prepara a próxima frase enquanto o outro fala e troca escuta por defesa',mono,300);
  expect(lines.at(-1)!.split(' ').length).toBeGreaterThan(1);
  expect(lines.every(l=>mono(l)<=300)).toBe(true);
 });
 it('usa o menor número de linhas possível',()=>{
  const text='Uma ideia tua pode estar errada e reconhecer isso não apaga tua história nem teu trabalho';
  const greedy=(()=>{let n=1,line='';for(const w of text.split(' ')){const next=line?line+' '+w:w;if(mono(next)>300){n++;line=w;}else line=next;}return n;})();
  expect(breakText(text,mono,300)).toHaveLength(greedy);
 });
 it('não termina linha em palavra curta de ligação quando há alternativa',()=>{
  const lines=breakText('A conversa deixa de servir ao encontro e começa a servir à tua necessidade',mono,320);
  for(const l of lines.slice(0,-1))expect(['a','o','e','de','ao','à','que']).not.toContain(l.split(' ').at(-1));
 });
 it('equilibra títulos',()=>{
  const [a,b]=breakText('A pressa troca escuta por defesa',mono,300,{balance:true});
  expect(Math.abs(a.length-b.length)).toBeLessThanOrEqual(4);
 });
 it('preserva parágrafos e linhas vazias',()=>expect(breakText('Um.\n\nDois.',mono,300)).toEqual(['Um.','','Dois.']));
 it('uma palavra maior que a caixa fica sozinha na linha para o fit reprovar',()=>expect(breakText('curto extraordinariamente curto',mono,100)).toEqual(['curto','extraordinariamente','curto']));
});
