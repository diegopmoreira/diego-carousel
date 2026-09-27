import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { loadProject, jsonHash, writeJson, optionalJson, log, withLock, contentDir, opaqueId, hash } from '../project/io.js';
import { toCopy, type Panel } from '../source/copy.js';
// "você" → "tu" for ready copy. The proposal changes only grammatical person; Diego approves it before it applies.
// Colloquial tu keeps third-person verb forms ("tu faz"), so most verbs stay; imperatives change ("pare" → "para").
const IMPERATIVE:Record<string,string>={pare:'para',faça:'faz',comece:'começa',aprenda:'aprende',siga:'segue',escolha:'escolhe',olhe:'olha',pense:'pensa',lembre:'lembra',deixe:'deixa',diga:'diz',veja:'vê',saiba:'sabe',tente:'tenta',pergunte:'pergunta',observe:'observa',perceba:'percebe',entenda:'entende',aceite:'aceita',cuide:'cuida',busque:'busca',procure:'procura',mude:'muda',repare:'repara',abandone:'abandona',troque:'troca',escute:'escuta',fale:'fala',volte:'volta',comente:'comenta',compartilhe:'compartilha',mande:'manda',salve:'salva',leia:'lê',assista:'assiste',use:'usa',acredite:'acredita',confie:'confia',evite:'evita',espere:'espera',ouça:'ouve',venha:'vem',ponha:'põe',traga:'traz'};
const PRONOUNS:[RegExp,string][]=[
 [/(?<![\p{L}])com você(?![\p{L}])/giu,'contigo'],
 [/(?<![\p{L}])(pra|para) você(?![\p{L}])/giu,'$1 ti'],
 [/(?<![\p{L}])(de|em|a|por|sobre|sem|contra|entre|até) você(?![\p{L}])/giu,'$1 ti'],
 [/(?<![\p{L}])você se(?![\p{L}])/giu,'tu te'],
 [/(?<![\p{L}])você(?![\p{L}])/giu,'tu'],
 [/(?<![\p{L}])lhe(?![\p{L}])/giu,'te'],
 [/(?<![\p{L}])si mesm([oa]s?)(?![\p{L}])/giu,'ti mesm$1'],
 [/(?<![\p{L}])consigo mesm([oa])(?![\p{L}])/giu,'contigo mesm$1'],
 [/(?<![\p{L}])seu(?![\p{L}])/giu,'teu'],[/(?<![\p{L}])sua(?![\p{L}])/giu,'tua'],[/(?<![\p{L}])seus(?![\p{L}])/giu,'teus'],[/(?<![\p{L}])suas(?![\p{L}])/giu,'tuas'],
];
// Word pairs a proposal may contain; anything else is not a change of person and blocks approval.
const PERSON_WORDS=new Set(['você','tu','te','ti','contigo','lhe','si','consigo','seu','sua','seus','suas','teu','tua','teus','tuas','se',...Object.keys(IMPERATIVE),...Object.values(IMPERATIVE)]);
const AMBIGUOUS=new Set(['seu','sua','seus','suas','lhe']);
const keepCase=(from:string,to:string)=>from[0]===from[0].toLocaleUpperCase('pt-BR')&&from[0]!==from[0].toLocaleLowerCase('pt-BR')?(from===from.toLocaleUpperCase('pt-BR')&&from.length>1?to.toLocaleUpperCase('pt-BR'):to[0].toLocaleUpperCase('pt-BR')+to.slice(1)):to;
export function toTu(text:string){
 let out=text;
 for(const [re,to] of PRONOUNS)out=out.replace(re,(m,...g)=>{const rep=to.replace(/\$(\d)/g,(_,n)=>g[Number(n)-1]);return keepCase(m,rep);});
 // Imperatives at the start of a sentence or after a line break.
 out=out.replace(/(^|[.!?]\s+|\n)(\*\*)?(\p{L}+)/gu,(m,lead,em,word)=>{const to=IMPERATIVE[word.toLocaleLowerCase('pt-BR')];return to?lead+(em??'')+keepCase(word,to):m;});
 return out;
}
type Change={panel:number;field:'headline'|'body';from:string;to:string;kind:'person'|'ambiguous'|'other'};
// Prepositions that merge with the pronoun ("com você" → "contigo", "para você" → "pra ti") belong to a person change.
const LINKED=new Set(['com','pra','para','de','em','a','por','sobre','sem','contra','entre','até']);
const clean=(w:string)=>w.replace(/[^\p{L}]/gu,'').toLocaleLowerCase('pt-BR');
// Word-level diff (longest common subsequence); each replaced run is classified as a whole.
function runs(x:string[],y:string[]){
 const n=x.length,m=y.length,L=Array.from({length:n+1},()=>new Int32Array(m+1));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)L[i][j]=x[i]===y[j]?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);
 const out:{from:string[];to:string[]}[]=[];let i=0,j=0,cur:{from:string[];to:string[]}|null=null;
 const flush=()=>{if(cur&&(cur.from.length||cur.to.length))out.push(cur);cur=null;};
 while(i<n||j<m){
  if(i<n&&j<m&&x[i]===y[j]){flush();i++;j++;continue;}
  cur??={from:[],to:[]};
  if(j<m&&(i>=n||L[i][j+1]>=L[i+1][j]))cur.to.push(y[j++]);else cur.from.push(x[i++]);
 }
 flush();return out;
}
export function diffPanels(a:Panel[],b:Panel[]):Change[]{
 const changes:Change[]=[];
 if(a.length!==b.length)throw Error('A proposta mudou o número de painéis');
 a.forEach((p,i)=>{for(const field of ['headline','body'] as const){
  const words=(t:string|null)=>(t??'').split(/\s+/).filter(Boolean);
  for(const r of runs(words(p[field]),words(b[i][field]))){
   const all=[...r.from,...r.to].map(clean).filter(Boolean);
   const person=all.length>0&&all.every(w=>PERSON_WORDS.has(w)||LINKED.has(w))&&[...r.from,...r.to].map(clean).some(w=>PERSON_WORDS.has(w));
   const kind=!person?'other':r.from.map(clean).some(w=>AMBIGUOUS.has(w))?'ambiguous':'person';
   changes.push({panel:i+1,field,from:r.from.join(' '),to:r.to.join(' '),kind});
  }
 }});
 return changes;
}
export const Approvals=z.object({schema_version:z.literal(1),$schema:z.string().optional(),approvals:z.array(z.object({id:z.string(),type:z.enum(['voice','edit']),by:z.string().min(2),note:z.string(),created_at:z.iso.datetime(),base_hash:z.string(),result_hash:z.string(),proposal_hash:z.string(),other_changes:z.number().int().min(0),result:z.array(z.object({headline:z.string(),body:z.string().nullable()}))}).strict())}).strict();
export async function loadApprovals(base:string){return Approvals.parse(await optionalJson(path.join(base,'approvals.json'))??{schema_version:1,approvals:[]});}
// The approved text chain: source panels, then each approval applied in order. Lint compares locked copy to its end.
export async function approvedPanels(base:string,source:Panel[]){
 let panels=source;const errors:string[]=[];
 for(const a of (await loadApprovals(base)).approvals){if(a.base_hash!==jsonHash(panels)){errors.push(`Aprovação ${a.id} não corresponde ao texto anterior`);break;}if(jsonHash(a.result)!==a.result_hash){errors.push(`Aprovação ${a.id} alterada`);break;}panels=a.result;}
 return {panels,errors};
}
const panelsOf=(slides:{headline:string;body:string|null}[])=>slides.map(({headline,body})=>({headline,body}));
function proposalMarkdown(original:Panel[],proposed:Panel[],changes:Change[]){
 const rows=original.map((p,i)=>{
  const mine=changes.filter(c=>c.panel===i+1);if(!mine.length)return '';
  const flag=(c:Change)=>c.kind==='other'?' ⚠ não é mudança de pessoa':c.kind==='ambiguous'?' ⚠ conferir (pode ser 3ª pessoa)':'';
  return `### P${i+1}\n\n**Original**\n\n${p.headline}${p.body?'\n\n'+p.body:''}\n\n**Proposta**\n\n${proposed[i].headline}${proposed[i].body?'\n\n'+proposed[i].body:''}\n\n${mine.map(c=>`- ${c.from} → ${c.to}${flag(c)}`).join('\n')}\n`;
 }).filter(Boolean);
 const other=changes.filter(c=>c.kind==='other').length,ambiguous=changes.filter(c=>c.kind==='ambiguous').length;
 return `# Proposta de voz: "você" → "tu"\n\nSó mudanças de pessoa verbal. Nada muda até Diego aprovar:\n\n\`\`\`sh\nnpm run carousel -- approve <projeto> voice --by Diego\n\`\`\`\n\n${changes.length} mudanças em ${rows.length} painéis · ${ambiguous} para conferir · ${other} fora da regra${other?' (bloqueiam a aprovação)':''}\n\n${rows.join('\n')}`;
}
export function proposeVoice(dir:string,{render=false}={}){return withLock(dir,async()=>{
 const base=await contentDir(dir),p=await loadProject(dir);
 if(!p.carousel.project.copy_locked)throw Error('voice é para copy pronta; no modo full a copy já é escrita em tu');
 const current=panelsOf(p.carousel.slides),file=path.join(base,'qa/voice-proposal.json');
 let proposed:Panel[];
 if(render){const saved=await optionalJson(file);if(!saved)throw Error('Sem proposta salva; rode voice sem --render');if(saved.base_hash!==jsonHash(current))throw Error('A copy mudou desde a proposta; gere outra');proposed=saved.panels;}
 else proposed=current.map(x=>({headline:toTu(x.headline),body:x.body===null?null:toTu(x.body)}));
 const changes=diffPanels(current,proposed);
 await writeJson(file,{schema_version:1,base_hash:jsonHash(current),panels:proposed,changes});
 await writeFile(path.join(base,'qa/voice-proposal.md'),proposalMarkdown(current,proposed,changes));
 await log(base,'EDITORIAL',`Proposta de voz: ${changes.length} mudanças`);
 return {changes:changes.length,ambiguous:changes.filter(c=>c.kind==='ambiguous').length,other:changes.filter(c=>c.kind==='other').length,file:path.join(base,'qa/voice-proposal.md')};
});}
export function approveVoice(dir:string,by:string,note='',{allowOther=false}={}){return withLock(dir,async()=>{
 const base=await contentDir(dir),p=await loadProject(dir);
 if(!by.trim()||by.trim().length<2)throw Error('Informe --by com o nome de quem aprovou');
 const proposal=await optionalJson(path.join(base,'qa/voice-proposal.json'));if(!proposal)throw Error('Sem proposta: rode voice primeiro');
 const current=panelsOf(p.carousel.slides);
 if(proposal.base_hash!==jsonHash(current))throw Error('A copy mudou desde a proposta; gere outra com voice');
 const changes=diffPanels(current,proposal.panels),other=changes.filter(c=>c.kind==='other').length;
 if(other&&!allowOther)throw Error(`${other} mudanças não são de pessoa verbal; revisar a proposta (ou --allow-other se Diego aprovou o texto inteiro)`);
 const approvals=await loadApprovals(base),result:Panel[]=proposal.panels;
 approvals.approvals.push({id:opaqueId(),type:'voice',by:by.trim(),note,created_at:new Date().toISOString(),base_hash:jsonHash(current),result_hash:jsonHash(result),proposal_hash:hash(await readFile(path.join(base,'qa/voice-proposal.json'))),other_changes:other,result});
 await writeJson(path.join(base,'approvals.json'),Approvals.parse(approvals));
 p.carousel.slides=p.carousel.slides.map((s,i)=>({...s,headline:result[i].headline,body:result[i].body}));
 await writeJson(path.join(base,'carousel.json'),p.carousel);await writeFile(path.join(base,'copy.md'),toCopy(result));
 await log(base,'APPROVAL',`Voz aprovada por ${by.trim()}: ${changes.length} mudanças`);
 return {applied:changes.length};
});}

// Editorial change to ready copy (e.g. compressing a body that does not fit): Claude proposes, Diego approves.
// Proposals accumulate per slide in qa/edit-proposal.json until approved.
export function proposeEdit(dir:string,slide:string,change:{headline?:string;body?:string|null;reason:string}){return withLock(dir,async()=>{
 const base=await contentDir(dir),p=await loadProject(dir);
 if(!p.carousel.project.copy_locked)throw Error('edit é para copy pronta; no modo full editar pelo draft');
 const index=p.carousel.slides.findIndex(s=>s.id===slide);if(index<0)throw Error('Slide desconhecido');
 if(change.headline===undefined&&change.body===undefined)throw Error('Informe --headline e/ou --body');
 if(!change.reason?.trim())throw Error('Informe --reason (por que mudar: não cabe, repetição…)');
 const current=panelsOf(p.carousel.slides),file=path.join(base,'qa/edit-proposal.json'),saved=await optionalJson(file);
 const state=saved&&saved.base_hash===jsonHash(current)?saved:{schema_version:1,base_hash:jsonHash(current),panels:structuredClone(current),reasons:{}};
 const panel=state.panels[index];
 if(change.headline!==undefined)panel.headline=change.headline.normalize('NFC').trim();
 if(change.body!==undefined)panel.body=change.body===null||!change.body.trim()?null:change.body.normalize('NFC').trim();
 state.reasons[index+1]=change.reason.trim();
 await writeJson(file,state);
 const rows=current.map((c,i)=>{const n=state.panels[i];if(c.headline===n.headline&&c.body===n.body)return '';
  const len=(t:string|null)=>t?t.replace(/\*\*/g,'').length:0;
  return `### P${i+1} — ${state.reasons[i+1]??''}\n\n**Original** (${len(c.body)} caracteres no body)\n\n${c.headline}${c.body?'\n\n'+c.body:''}\n\n**Proposta** (${len(n.body)} caracteres no body)\n\n${n.headline}${n.body?'\n\n'+n.body:''}\n`;}).filter(Boolean);
 await writeFile(path.join(base,'qa/edit-proposal.md'),`# Proposta de edição da copy pronta\n\nNada muda até Diego aprovar:\n\n\`\`\`sh\nnpm run carousel -- approve <projeto> edit --by Diego\n\`\`\`\n\n${rows.join('\n')}`);
 return {slides:rows.length,file:path.join(base,'qa/edit-proposal.md')};
});}
export function approveEdit(dir:string,by:string,note=''){return withLock(dir,async()=>{
 const base=await contentDir(dir),p=await loadProject(dir);
 if(!by.trim()||by.trim().length<2)throw Error('Informe --by com o nome de quem aprovou');
 const file=path.join(base,'qa/edit-proposal.json'),proposal=await optionalJson(file);if(!proposal)throw Error('Sem proposta: rode edit primeiro');
 const current=panelsOf(p.carousel.slides);if(proposal.base_hash!==jsonHash(current))throw Error('A copy mudou desde a proposta; refazer');
 const result:Panel[]=proposal.panels,approvals=await loadApprovals(base);
 approvals.approvals.push({id:opaqueId(),type:'edit',by:by.trim(),note:note||Object.entries(proposal.reasons).map(([k,v])=>`P${k}: ${v}`).join('; '),created_at:new Date().toISOString(),base_hash:jsonHash(current),result_hash:jsonHash(result),proposal_hash:hash(await readFile(file)),other_changes:0,result});
 await writeJson(path.join(base,'approvals.json'),Approvals.parse(approvals));
 p.carousel.slides=p.carousel.slides.map((s,i)=>({...s,headline:result[i].headline,body:result[i].body}));
 await writeJson(path.join(base,'carousel.json'),p.carousel);await writeFile(path.join(base,'copy.md'),toCopy(result));
 await log(base,'APPROVAL',`Edição aprovada por ${by.trim()}`);
 return {applied:true};
});}
