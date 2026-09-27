import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadProject, jsonHash, writeJson, hash, contentDir } from '../project/io.js';
import { parseCopy, plainText } from '../source/copy.js';
export type Issue={severity:'error'|'warning';path:string;message:string};
export async function lint(dir:string){
 const base=await contentDir(dir),p=await loadProject(dir),c=p.carousel,issues:Issue[]=[];
 const add=(severity:Issue['severity'],at:string,message:string)=>issues.push({severity,path:at,message});
 if(c.slides.length<8||c.slides.length>12)add('error','slides','São necessários 8–12 painéis');
 const forbidden=['antes de começar','neste carrossel','siga meu perfil','compartilhe com seus amigos','5 dicas','você merece','transforme sua vida','descubra o segredo','junto com você nessa jornada','vamos juntos','acredite em si mesmo'];
 c.slides.forEach((s,i)=>{
  const t=plainText(s.headline+'\n'+(s.body??'')).toLocaleLowerCase('pt-BR');
  if(i===0&&s.body)add('error',`slides.${i}.body`,'A capa deve ser sem body');
  if(plainText(s.headline).split(/\s+/).length<3)add('warning',`slides.${i}.headline`,'Headline curta: verificar se é apenas um rótulo');
  if(/(?<!\p{L})voc[eê]s?(?!\p{L})/iu.test(t))add('error',`slides.${i}`,'A voz usa sempre tu');
  if(/\b(seu|sua|seus|suas)\b/u.test(t))add('warning',`slides.${i}`,'Verificar pronome possessivo: prefere teu/tua');
  for(const phrase of forbidden)if(t.includes(phrase))add('error',`slides.${i}`,`Expressão proibida: ${phrase}`);
  if(s.body&&(plainText(s.body).length<120||plainText(s.body).length>350))add('warning',`slides.${i}.body`,'Body fora da faixa inicial de 120–350 caracteres; o fit decide legibilidade');
  if(i<c.slides.length-1&&!s.next_question)add(c.project.mode==='full'?'error':'warning',`slides.${i}.next_question`,'Registrar a pergunta que conduz ao próximo painel');
  if(i>0&&s.adds.some(a=>c.slides[i-1].adds.includes(a)))add('warning',`slides.${i}.adds`,'Adição repetida no painel vizinho');
  const words=new Set(plainText(s.headline).toLowerCase().split(/\s+/));
  for(let j=0;j<i;j++){const other=new Set(plainText(c.slides[j].headline).toLowerCase().split(/\s+/));const overlap=[...words].filter(w=>other.has(w)).length/new Set([...words,...other]).size;if(overlap>.8)add('warning',`slides.${i}.headline`,`Headline semelhante a P${j+1}`);}
 });
 const extra=[c.editorial.caption,c.editorial.cta.text].join('\n').toLowerCase();
 if(/(?<!\p{L})voc[eê]s?(?!\p{L})/iu.test(extra))add('error','editorial','Legenda e CTA também usam tu');
 for(const phrase of forbidden)if(extra.includes(phrase))add('error','editorial',`Expressão proibida: ${phrase}`);
 if(c.project.copy_locked){
  try{const raw=await readFile(path.join(base,'source/copy-input.md'),'utf8');if(hash(raw)!==c.source.hash)add('error','source.hash','Fonte original alterada');const panels=parseCopy(raw);if(JSON.stringify(panels)!==JSON.stringify(c.slides.map(({headline,body})=>({headline,body}))))add('error','slides','Copy travada difere da fonte original (NFC)');}catch(e){add('error','source',`Não foi possível conferir copy original: ${String(e)}`);}
 }
 if(c.project.mode==='full'){
  if(!c.editorial.central_thesis.trim())add('error','editorial.central_thesis','Tese ausente');
  const report=await readFile(path.join(base,'editorial-report.md'),'utf8').catch(()=> '');
  for(const title of ['Mapa da fonte','Diagnóstico','Teses','Hooks','Spine'])if(!report.includes(`## ${title}`))add('error','editorial-report.md',`Seção ausente: ${title}`);
 }
 const result={schema_version:1,content_hash:jsonHash(c),passed:!issues.some(i=>i.severity==='error'),issues};
 await writeJson(path.join(dir,'qa/editorial-lint.json'),result);return result;
}
export async function visualLint(dir:string){
 const {carousel:c,art:a,tweaks:t,assets:m}=await loadProject(dir);const errors:string[]=[];const ids=new Set(c.slides.map(s=>s.id));
 for(const [name,map] of Object.entries({art:a.slides,tweaks:t.slides}))for(const id of Object.keys(map))if(!ids.has(id))errors.push(`${name}.${id}: entrada órfã`);
 let last='',run=0;
 c.slides.forEach(s=>{const d=a.slides[s.id];if(!d){errors.push(`${s.id}: direção ausente`);return;}const comp=t.slides[s.id]?.composition??d.composition;run=comp===last?run+1:1;last=comp;if(run>2)errors.push(`${s.id}: mais de duas composições iguais seguidas`);if(d.image.need&&!d.image.asset_id&&!d.image.placeholder)errors.push(`${s.id}: falta asset ou placeholder declarado`);if(d.image.asset_id&&!m.assets.some(x=>x.id===d.image.asset_id))errors.push(`${s.id}: asset não registrado`);if(d.image.asset_id&&!['full_bleed','cinematic_fade','image_card'].includes(comp))errors.push(`${s.id}: composição ${comp} não possui slot de imagem`);});
 if(c.slides.length&&c.slides.every(s=>a.slides[s.id]?.density==='HIGH'))errors.push('Todos os slides estão HIGH');return errors;
}
