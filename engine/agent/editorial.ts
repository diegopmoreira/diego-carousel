import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { z } from 'zod';
import { ROOT, writeJson, optionalJson, loadProject, log, withLock, jsonHash } from '../project/io.js';
import { loadConfig } from '../project/config.js';
// The editorial agent: Claude Code run headless with the diego-carousel skill on a project that has a transcript and
// no copy yet. The studio (or the CLI) starts it; a detached runner (runner.ts) supervises `claude -p` and writes the
// state, so a run survives a studio restart. With the thesis checkpoint on, it runs in two stages: `thesis` (phases
// 1–3, then the options Diego chooses from) and `write` (the rest, resuming the same Claude session).
export const AGENT_FILES={state:'qa/agent.json',log:'qa/agent.log',options:'qa/thesis-options.json',choice:'qa/thesis-choice.json'} as const;
export const AgentStage=z.enum(['thesis','write','full']);
export type Stage=z.infer<typeof AgentStage>;
export const AgentState=z.object({
 schema_version:z.literal(1),
 status:z.enum(['running','waiting','done','failed','stopped']),
 stage:AgentStage,
 session_id:z.string().uuid(),
 resume:z.boolean().default(false),
 family:z.enum(['auto','editorial_clean','cinematic_condensed']).default('auto'),
 started_by:z.string().default(''),
 started_at:z.string(),
 finished_at:z.string().optional(),
 pid:z.number().int().optional(),
 activity:z.string().default(''),
 summary:z.string().optional(),
 error:z.string().optional(),
 warning:z.string().optional(),
 cost_usd:z.number().optional(),
 turns:z.number().int().optional(),
}).strict();
export type AgentStateData=z.infer<typeof AgentState>;
const id=(prefix:string)=>z.string().regex(new RegExp(`^${prefix}\\d{1,2}$`),`use ${prefix}1, ${prefix}2…`);
// What the agent offers at the checkpoint: the recommended thesis first, alternatives, and the hooks of the
// recommended thesis (editorial/thesis-selection.md, hook-matrix.md).
export const ThesisOptions=z.object({
 schema_version:z.literal(1),
 theses:z.array(z.object({id:id('t'),text:z.string().trim().min(10).max(300),why:z.string().trim().min(5).max(800)}).strict()).min(2).max(6),
 hooks:z.array(z.object({id:id('h'),text:z.string().trim().min(5).max(220),family:z.string().trim().max(80).default('')}).strict()).min(3).max(10),
 recommended:z.object({thesis:id('t'),hook:id('h')}).strict(),
}).strict().superRefine((o,ctx)=>{
 const t=o.theses.map(x=>x.id),h=o.hooks.map(x=>x.id);
 if(new Set(t).size!==t.length)ctx.addIssue({code:'custom',message:'IDs de tese repetidos'});
 if(new Set(h).size!==h.length)ctx.addIssue({code:'custom',message:'IDs de hook repetidos'});
 if(!t.includes(o.recommended.thesis))ctx.addIssue({code:'custom',message:'recommended.thesis precisa ser uma das teses'});
 if(!h.includes(o.recommended.hook))ctx.addIssue({code:'custom',message:'recommended.hook precisa ser um dos hooks'});
});
export type ThesisOptionsData=z.infer<typeof ThesisOptions>;
// Diego's choice. hook null with an empty hook_text: another thesis was chosen and the agent redoes the hooks for it.
export const ThesisChoice=z.object({
 schema_version:z.literal(1),
 thesis:id('t'),thesis_text:z.string().min(10),
 hook:id('h').nullable(),hook_text:z.string().max(220),
 note:z.string().max(2000).default(''),
 by:z.string().trim().min(2).max(80),
 options_hash:z.string(),
 at:z.string(),
}).strict();
export type ThesisChoiceData=z.infer<typeof ThesisChoice>;
// Bash only through the engine's CLI; files through the editing tools (accepted inside the workspace only);
// a subagent for the blind test; web search for current films (Fase 8); the Corpus MCP when it is connected.
export const ALLOWED_TOOLS=['Bash(npm run carousel:*)','Bash(npm run -s carousel:*)','Read','Write','Edit','Glob','Grep','Task','Agent','Skill','WebSearch','mcp__corpus-diego'];
const file=(dir:string,name:keyof typeof AGENT_FILES)=>path.join(dir,AGENT_FILES[name]);
// The Claude Code CLI: CAROUSEL_CLAUDE_BIN, then PATH, then the usual install places (native installer in
// ~/.local/bin, older installs under ~/.claude/local when claude is only a shell alias, Homebrew, npm global).
export async function claudeBin():Promise<string|null>{
 const candidates=[process.env.CAROUSEL_CLAUDE_BIN,...(process.env.PATH??'').split(path.delimiter).filter(Boolean).map(d=>path.join(d,'claude')),path.join(os.homedir(),'.local/bin/claude'),path.join(os.homedir(),'.claude/local/claude'),'/opt/homebrew/bin/claude','/usr/local/bin/claude'].filter((c):c is string=>!!c);
 for(const c of candidates){try{await access(c,constants.X_OK);return c;}catch{}}
 return null;
}
const alive=(pid:number)=>{try{process.kill(pid,0);return true;}catch(e){return (e as NodeJS.ErrnoException).code==='EPERM';}};
export async function readAgentState(dir:string):Promise<AgentStateData|null>{
 const raw=await optionalJson(file(dir,'state'));if(!raw)return null;
 const state=AgentState.parse(raw);
 // A run whose runner is gone (computer or studio restarted in the middle) is reported as failed, not running forever.
 if(state.status==='running'&&(state.pid?!alive(state.pid):Date.now()-Date.parse(state.started_at)>60_000))
  return {...state,status:'failed',error:'O processo do agente parou sem terminar (estúdio ou computador reiniciado?). Tenta de novo.'};
 return state;
}
export async function readOptions(dir:string){const raw=await optionalJson(file(dir,'options'));return raw?ThesisOptions.parse(raw):null;}
export async function readChoice(dir:string){const raw=await optionalJson(file(dir,'choice'));return raw?ThesisChoice.parse(raw):null;}
// Called by the agent at the checkpoint: the options are validated here, so a malformed file is refused on the spot.
export async function saveThesisOptions(dir:string,source:string){
 const options=ThesisOptions.parse(JSON.parse(await readFile(source,'utf8')));
 await writeJson(file(dir,'options'),options);
 await log(dir,'AGENT',`Opções de tese gravadas: ${options.theses.length} teses, ${options.hooks.length} hooks`);
 return options;
}
export async function chooseThesis(dir:string,input:{thesis:string;hook?:string|null;hook_text?:string;note?:string;by:string}){
 const options=await readOptions(dir);if(!options)throw Error('O agente ainda não gravou as opções de tese');
 const thesis=options.theses.find(t=>t.id===input.thesis);if(!thesis)throw Error(`Tese desconhecida: ${input.thesis}`);
 const recommended=thesis.id===options.recommended.thesis,custom=input.hook_text?.trim()??'';
 // The hooks on offer belong to the recommended thesis: with another thesis only a hook written by Diego applies.
 const hook=recommended&&input.hook?options.hooks.find(h=>h.id===input.hook):undefined;
 if(recommended&&input.hook&&!hook)throw Error(`Hook desconhecido: ${input.hook}`);
 if(!recommended&&input.hook)throw Error('Os hooks propostos são da tese recomendada: para outra tese, deixa o agente refazer os hooks ou escreve o teu');
 const choice=ThesisChoice.parse({schema_version:1,thesis:thesis.id,thesis_text:thesis.text,hook:hook?.id??null,hook_text:custom||hook?.text||'',note:input.note?.trim()??'',by:input.by,options_hash:jsonHash(options),at:new Date().toISOString()});
 await writeJson(file(dir,'choice'),choice);
 await log(dir,'AGENT',`Escolha de ${choice.by}: tese ${choice.thesis}${choice.hook?`, hook ${choice.hook}`:choice.hook_text?', hook escrito por Diego':', hooks a refazer'}`);
 return choice;
}
const quote=(t:string)=>`"${t.replace(/\s+/g,' ').trim()}"`;
export function agentPrompt(dir:string,stage:Stage,{choice,family='auto'}:{choice?:ThesisChoiceData|null;family?:string}={}){
 const cli='npm run carousel --';
 const head=[`Use a skill diego-carousel no projeto ${dir} (modo full). A transcrição já está importada em ${path.join(dir,'source/transcript.txt')}: não crie outro projeto e não mexa em outros projetos.`,
  'Execução pelo estúdio, sem conversa: ninguém responde durante a execução. Não faça perguntas; decida pelos guias da Skill e registre as dúvidas no editorial-report.md. Os guias (editorial/, visual/, genetic-library/) ficam na raiz do repositório. Comente o que está fazendo em português, em frases curtas: Diego acompanha pelo estúdio.',
  `Ferramentas: Read, Glob e Grep para ler e procurar arquivos; o terminal só aceita \`${cli} …\` (outros comandos são negados). \`${cli} status ${dir}\` diz a próxima fase; \`${cli} idea list\` mostra o backlog.`];
 const visual=['Para medir a copy (tamanho dos bodies, voz, vocabulários), rode draft e lint: o lint mostra cada body fora da faixa, e o redraft é barato (mantém os IDs). Não meça no terminal.',
  family!=='auto'?`Família visual escolhida por Diego no estúdio: ${family}.`:'Família visual: escolher pela heurística da Fase 7.',
  'Fase 8 só como roteiro: cenas de filme ou série em image.concept e a seção ## Cenas (processo de Diego em visual/image-policy.md). Não gere imagens nem baixe frames.',
  `Fase 9: render; se algo não couber, fit-probe/autofit ou comprimir a copy; abrir os PNGs e registrar a revisão com \`${cli} review ${dir} --reviewer Claude --note "…"\`. Não exporte.`,
  'Termine com um resumo de até 3 linhas: a tese, quantos painéis e o que ficou pendente (imagens, avisos).'];
 const options=`Escreva um JSON com a tese recomendada e 2 alternativas e os hooks da tese recomendada, e grave com \`${cli} thesis-options ${dir} <arquivo.json>\` (o comando valida; se recusar, corrija e repita). Formato: {"schema_version":1,"theses":[{"id":"t1","text":"…","why":"…"}],"hooks":[{"id":"h1","text":"…","family":"…"}],"recommended":{"thesis":"t1","hook":"h1"}} — 2 a 6 teses (a recomendada primeiro), 3 a 10 hooks de famílias diferentes.`;
 if(stage==='thesis')return [...head,
  'Etapa 1 de 2 (checkpoint da tese): faça as Fases 1 a 3 no editorial-report.md do projeto (## Mapa da fonte, ## Diagnóstico, ## Teses, ## Hooks).',
  options,
  'Pare aí: não escreva a spine nem a copy, não rode draft e não mande teses para o backlog (isso vem depois da escolha). Diego escolhe a tese no estúdio e a etapa 2 continua desta conversa.',
  'Termine com uma linha: a tese recomendada e o hook recomendado.'].join('\n\n');
 if(stage==='full')return [...head,'Sem checkpoint da tese: siga as Fases 1 a 9 da Skill do começo ao fim.',...visual].join('\n\n');
 if(!choice)throw Error('Etapa 2 sem a escolha de Diego (qa/thesis-choice.json)');
 return [...head,
  `Etapa 2 de 2. Diego escolheu no estúdio (vale como o checkpoint da tese):\n- Tese: ${quote(choice.thesis_text)} (${choice.thesis})\n- Hook: ${choice.hook_text?quote(choice.hook_text):'nenhum dos propostos: refaça ## Hooks para esta tese antes de seguir'}${choice.note?`\n- Nota de Diego: ${quote(choice.note)}`:''}`,
  'Registre a escolha no editorial-report.md e continue: as teses que sobraram vão para o backlog (idea add); Fases 4 a 7 (spine, teste cego com subagente, copy.md + editorial.json, draft, lint, direção de arte).',
  ...visual].join('\n\n');
}
// Starts (or restarts) a stage in a detached runner. The stage defaults to what comes next for the project.
export function startAgent(dir:string,{stage,family,by=''}:{stage?:Stage;family?:AgentStateData['family'];by?:string}={}){return withLock(dir,async()=>{
 if(await optionalJson(path.join(dir,'variant.json')))throw Error('O agente trabalha no projeto principal, não numa versão');
 const p=await loadProject(dir);
 if(p.carousel.project.mode!=='full'||p.carousel.project.copy_locked)throw Error('O agente escreve a copy a partir da transcrição: este projeto é de copy pronta');
 const previous=await readAgentState(dir);
 if(previous?.status==='running')throw Error('O agente já está trabalhando neste projeto');
 const bin=await claudeBin();
 if(!bin)throw Error('Claude Code não encontrado: instala o Claude Code (comando claude) ou define CAROUSEL_CLAUDE_BIN com o caminho dele');
 const config=await loadConfig(),choice=await readChoice(dir),options=await readOptions(dir);
 const next:Stage=stage??(options&&choice&&choice.options_hash===jsonHash(options)?'write':config.editorial.checkpoint_after_thesis?'thesis':'full');
 if(next==='write'&&(!choice||!options||choice.options_hash!==jsonHash(options)))throw Error('A etapa 2 precisa da escolha de Diego sobre as opções atuais');
 // Stage 2 resumes the Claude session of stage 1 (the transcript and the analysis stay in context); a retry of stage 2
 // resumes the same conversation, which also holds the attempt that failed.
 const resume=next==='write'&&!!previous&&(previous.stage==='thesis'||previous.stage==='write');
 const state:AgentStateData=AgentState.parse({schema_version:1,status:'running',stage:next,session_id:resume?previous!.session_id:randomUUID(),resume,family:family??previous?.family??'auto',started_by:by||previous?.started_by||'',started_at:new Date().toISOString(),activity:'Iniciando o agente'});
 await writeJson(file(dir,'state'),state);
 const child=spawn(process.execPath,['--import','tsx',path.join(ROOT,'engine/agent/runner.ts'),path.resolve(dir)],{cwd:ROOT,env:process.env,detached:true,stdio:'ignore'});
 child.unref();
 await log(dir,'AGENT',`Etapa ${next} iniciada${resume?' (retomando a sessão da etapa 1)':''}`);
 return {...state,pid:child.pid};
});}
export async function stopAgent(dir:string){
 const state=await readAgentState(dir);
 if(!state||state.status!=='running')throw Error('O agente não está rodando neste projeto');
 // The runner leads its own process group (detached): stopping the group stops Claude and its tools too.
 if(state.pid){try{process.kill(-state.pid,'SIGTERM');}catch{try{process.kill(state.pid,'SIGTERM');}catch{}}}
 const stopped={...state,status:'stopped' as const,finished_at:new Date().toISOString(),activity:'Interrompido'};
 await writeJson(file(dir,'state'),stopped);await log(dir,'AGENT','Interrompido');
 return stopped;
}
// Progress for the studio: the phases done so far (read from the project's files), the last lines of the log.
export async function agentView(dir:string){
 const state=await readAgentState(dir);if(!state)return null;
 const [options,choice,p,report,lint,manifest,review,logText]=await Promise.all([readOptions(dir).catch(()=>null),readChoice(dir).catch(()=>null),loadProject(dir),
  readFile(path.join(dir,'editorial-report.md'),'utf8').catch(()=>''),optionalJson(path.join(dir,'qa/editorial-lint.json')),optionalJson(path.join(dir,'render-manifest.json')),
  optionalJson(path.join(dir,'qa/visual-review.json')),readFile(file(dir,'log'),'utf8').catch(()=>'')]);
 const has=(t:string)=>report.includes(`## ${t}`),slides=p.carousel.slides.length;
 const phases=[
  {id:'map',label:'Mapa da fonte',done:has('Mapa da fonte')},{id:'diagnosis',label:'Diagnóstico',done:has('Diagnóstico')},
  {id:'theses',label:'Teses',done:has('Teses')},{id:'hooks',label:'Hooks',done:has('Hooks')},
  ...(state.stage==='full'?[]:[{id:'choice',label:'Escolha da tese',done:!!choice}]),
  {id:'spine',label:'Spine',done:has('Spine')},{id:'blind',label:'Teste cego',done:has('Teste cego')},
  {id:'copy',label:'Copy e slides',done:slides>0},{id:'lint',label:'Lint',done:slides>0&&!!lint?.passed},
  {id:'render',label:'Render',done:slides>0&&!!manifest},{id:'review',label:'Revisão visual',done:slides>0&&!!review},
 ];
 const optionsHash=options?jsonHash(options):null;
 return {state,options,options_hash:optionsHash,choice:choice&&choice.options_hash===optionsHash?choice:null,phases,log:logText.trimEnd().split('\n').slice(-40)};
}
