import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadProject, jsonHash, writeJson, hash, contentDir } from '../project/io.js';
import { parseCopy, plainText } from '../source/copy.js';
import { loadConfig } from '../project/config.js';
import { approvedPanels } from './voice.js';
import { NARRATIVE_ROLES, HEADLINE_TYPES, ADDS } from '../schema/index.js';
export type Issue={severity:'error'|'warning';path:string;message:string};
export async function lint(dir:string){
 const base=await contentDir(dir),p=await loadProject(dir),c=p.carousel,issues:Issue[]=[];
 const add=(severity:Issue['severity'],at:string,message:string)=>issues.push({severity,path:at,message});
 const {slides:range,editorial:{body_range:[bodyMin,bodyMax]}}=await loadConfig();
 if(c.slides.length<range.min||c.slides.length>range.max)add('error','slides',`São necessários ${range.min}–${range.max} painéis`);
 const voiceSeverity:Issue['severity']=c.project.mode==='full'?'error':'warning';
 const forbidden=['antes de começar','neste carrossel','siga meu perfil','compartilhe com seus amigos','5 dicas','você merece','transforme sua vida','descubra o segredo','junto com você nessa jornada','vamos juntos','acredite em si mesmo'];
 c.slides.forEach((s,i)=>{
  const t=plainText(s.headline+'\n'+(s.body??'')).toLocaleLowerCase('pt-BR');
  if(i===0&&s.body)add('error',`slides.${i}.body`,'A capa deve ser sem body');
  if(plainText(s.headline).split(/\s+/).length<3)add('warning',`slides.${i}.headline`,'Headline curta: verificar se é apenas um rótulo');
  // Ready copy is Diego's approved text: "você" is flagged, never blocked. Copy written by the system must use tu.
  if(/(?<!\p{L})voc[eê]s?(?!\p{L})/iu.test(t))add(voiceSeverity,`slides.${i}`,c.project.mode==='full'?'A voz usa sempre tu':'Copy pronta usa "você": a proposta em tu só entra com aval de Diego');
  if(/\b(seu|sua|seus|suas)\b/u.test(t))add('warning',`slides.${i}`,'Verificar pronome possessivo: prefere teu/tua');
  for(const phrase of forbidden)if(t.includes(phrase))add('error',`slides.${i}`,`Expressão proibida: ${phrase}`);
  if(s.body&&(plainText(s.body).length<bodyMin||plainText(s.body).length>bodyMax))add('warning',`slides.${i}.body`,`Body com ${plainText(s.body).length} caracteres, fora da faixa ${bodyMin}–${bodyMax} (config.json); o fit decide legibilidade`);
  if(i<c.slides.length-1&&!s.next_question)add(c.project.mode==='full'?'error':'warning',`slides.${i}.next_question`,'Registrar a pergunta que conduz ao próximo painel');
  if(i>0&&s.adds.some(a=>c.slides[i-1].adds.includes(a)))add('warning',`slides.${i}.adds`,'Adição repetida no painel vizinho');
  const words=new Set(plainText(s.headline).toLowerCase().split(/\s+/));
  for(let j=0;j<i;j++){const other=new Set(plainText(c.slides[j].headline).toLowerCase().split(/\s+/));const overlap=[...words].filter(w=>other.has(w)).length/new Set([...words,...other]).size;if(overlap>.8)add('warning',`slides.${i}.headline`,`Headline semelhante a P${j+1}`);}
 });
 const extra=[c.editorial.caption,c.editorial.cta.text].join('\n').toLowerCase();
 if(/(?<!\p{L})voc[eê]s?(?!\p{L})/iu.test(extra))add(voiceSeverity,'editorial','Legenda e CTA também usam tu');
 for(const phrase of forbidden)if(extra.includes(phrase))add('error','editorial',`Expressão proibida: ${phrase}`);
 if(c.project.copy_locked){
  try{const raw=await readFile(path.join(base,'source/copy-input.md'),'utf8');if(hash(raw)!==c.source.hash)add('error','source.hash','Fonte original alterada');const approved=await approvedPanels(base,parseCopy(raw));for(const e of approved.errors)add('error','approvals.json',e);if(JSON.stringify(approved.panels)!==JSON.stringify(c.slides.map(({headline,body})=>({headline,body}))))add('error','slides','Copy travada difere da fonte original (NFC) e das mudanças aprovadas');}catch(e){add('error','source',`Não foi possível conferir copy original: ${String(e)}`);}
 }
 if(c.project.mode==='full'){
  if(!c.editorial.central_thesis.trim())add('error','editorial.central_thesis','Tese ausente');
  const report=await readFile(path.join(base,'editorial-report.md'),'utf8').catch(()=> '');
  for(const title of ['Mapa da fonte','Diagnóstico','Teses','Hooks','Spine','Teste cego'])if(!report.includes(`## ${title}`))add('error','editorial-report.md',`Seção ausente: ${title}`);
  for(const field of ['objective','audience','angle','promise','belief','contradiction','mechanism','architecture'] as const)if(!c.editorial[field].trim())add('warning',`editorial.${field}`,'Campo do briefing/tese vazio');
  const hook=c.editorial.hook;
  if(!hook)add('error','editorial.hook','Hook escolhido ausente');
  else if(hook.viral_score){const low=(['impact','clarity','tension'] as const).filter(k=>hook.viral_score![k]<7);if(low.length)add('warning','editorial.hook.viral_score',`Hook abaixo do piso 7 em: ${low.join(', ')}`);}
  if(c.editorial.hook_candidates.length<5)add('warning','editorial.hook_candidates','Gerar 5–10 hooks de famílias diferentes');
  if(c.slides[0]&&hook&&plainText(c.slides[0].headline)!==plainText(hook.text))add('warning','slides.0.headline','A capa difere do hook escolhido');
  c.slides.forEach((s,i)=>{
   if(!NARRATIVE_ROLES.includes(s.narrative_role))add('warning',`slides.${i}.narrative_role`,`Papel fora do vocabulário: ${s.narrative_role}`);
   if(!HEADLINE_TYPES.includes(s.headline_type))add('warning',`slides.${i}.headline_type`,`Família de headline fora do vocabulário: ${s.headline_type}`);
   if(!s.adds.length)add('warning',`slides.${i}.adds`,'Registrar o que o painel acrescenta');
   for(const a of s.adds)if(!ADDS.includes(a))add('warning',`slides.${i}.adds`,`adds fora do vocabulário: ${a}`);
  });
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
