import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { z } from 'zod';
import { ROOT } from '../project/io.js';
import { NARRATIVE_ROLES } from '../schema/index.js';
import { plainText } from '../source/copy.js';
// genetic-library/editorial/*.yaml — Diego's published carousels, transcribed as they are (genetic-library/README.md).
export const EditorialExample=z.object({
 name:z.string().regex(/^[a-z0-9-]+$/),published:z.string().min(1),family:z.enum(['cinematic_condensed','editorial_clean','twitter']),
 thesis:z.string().min(10),architecture:z.string().min(3),hook_family:z.string().optional(),cta:z.enum(['none','share_specific','comment_keyword']).default('none'),
 slides:z.array(z.object({n:z.number().int().min(1),role:z.string().optional(),headline:z.string().min(1),body:z.string().nullable().default(null)}).strict()).min(6).max(14),
 notes:z.string().optional(),
}).strict().superRefine((v,ctx)=>{v.slides.forEach((s,i)=>{if(s.n!==i+1)ctx.addIssue({code:'custom',path:['slides',i,'n'],message:'Numeração deve seguir 1..n'});if(s.role&&!NARRATIVE_ROLES.includes(s.role))ctx.addIssue({code:'custom',path:['slides',i,'role'],message:`Papel fora do vocabulário: ${s.role}`});});});
export type Example=z.infer<typeof EditorialExample>;
export const libraryDir=()=>path.resolve(process.env.CAROUSEL_LIBRARY_DIR||path.join(ROOT,'genetic-library'));
export async function loadEditorialLibrary(){
 const dir=path.join(libraryDir(),'editorial'),files=(await readdir(dir).catch(()=>[])).filter(f=>/\.ya?ml$/.test(f)).sort();
 const examples:Example[]=[],errors:string[]=[];
 for(const f of files){try{examples.push(EditorialExample.parse(parse((await readFile(path.join(dir,f),'utf8')).normalize('NFC'))));}catch(e){errors.push(`${f}: ${e instanceof z.ZodError?e.issues.map(i=>`${i.path.join('.')} ${i.message}`).join('; '):String(e)}`);}}
 return {examples,errors};
}
const quantile=(v:number[],q:number)=>{if(!v.length)return null;const s=[...v].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(q*(s.length-1)+.5))];};
// Numbers the lint thresholds are calibrated on (body length, headline words, voice, panel count).
export function libraryStats(examples:Example[]){
 const bodies=examples.flatMap(e=>e.slides.filter(s=>s.body).map(s=>plainText(s.body!).length));
 const words=examples.flatMap(e=>e.slides.slice(1).map(s=>plainText(s.headline).split(/\s+/).length));
 const all=examples.flatMap(e=>e.slides.map(s=>`${s.headline} ${s.body??''}`)).join(' ').toLocaleLowerCase('pt-BR');
 const count=(re:RegExp)=>(all.match(re)??[]).length;
 return {carousels:examples.length,panels:{min:Math.min(...examples.map(e=>e.slides.length)),max:Math.max(...examples.map(e=>e.slides.length))},
  body_chars:{n:bodies.length,p10:quantile(bodies,.1),median:quantile(bodies,.5),p90:quantile(bodies,.9),min:bodies.length?Math.min(...bodies):null,max:bodies.length?Math.max(...bodies):null},
  headline_words:{p10:quantile(words,.1),median:quantile(words,.5),p90:quantile(words,.9)},
  voice:{tu:count(/(?<!\p{L})tu(?!\p{L})/gu),voce:count(/(?<!\p{L})você(?!\p{L})/gu),teu_tua:count(/(?<!\p{L})(teu|tua|teus|tuas)(?!\p{L})/gu),seu_sua:count(/(?<!\p{L})(seu|sua|seus|suas)(?!\p{L})/gu)},
  architectures:Object.fromEntries([...new Set(examples.map(e=>e.architecture))].map(a=>[a,examples.filter(e=>e.architecture===a).length])),
  suggestion:bodies.length>=10?{body_range:[quantile(bodies,.1),quantile(bodies,.9)]}:'Poucos exemplos: manter a faixa inicial 120–350'};
}
