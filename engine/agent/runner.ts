// Supervises one stage of the editorial agent (started detached by startAgent): runs `claude -p` with the stage
// prompt, turns its event stream into a short activity line and a readable log (qa/agent.log), and writes the final
// state (qa/agent.json). Stage 2 resumes the Claude session of stage 1; if that session is gone, it starts a new one
// (the editorial report carries the context).
import path from 'node:path';
import readline from 'node:readline';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import { ROOT, readJson, writeJson, loadProject, log, optionalJson } from '../project/io.js';
import { loadConfig, type ConfigData } from '../project/config.js';
import { AGENT_FILES, AgentState, ALLOWED_TOOLS, agentPrompt, claudeBin, readChoice, readOptions, type AgentStateData } from './editorial.js';
const dir=path.resolve(process.argv[2]??'.'),stateFile=path.join(dir,AGENT_FILES.state),logFile=path.join(dir,AGENT_FILES.log);
const STAGES={thesis:'1 (até as opções de tese)',write:'2 (da tese escolhida ao render)',full:'única (da transcrição ao render)'};
let state:AgentStateData|undefined,child:ChildProcess|undefined,stopping=false,timedOut=false,lastWrite=0,pending:NodeJS.Timeout|undefined;
const clock=()=>new Date().toLocaleTimeString('pt-BR',{hour12:false,timeZone:'America/Sao_Paulo'});
const line=(text:string)=>appendFile(logFile,`${clock()}  ${text.replace(/\s+/g,' ').trim().slice(0,400)}\n`).catch(()=>{});
// The activity line changes often: write it at most every 2 s (the studio refreshes on each write).
function touch(){if(pending||!state)return;pending=setTimeout(()=>{pending=undefined;lastWrite=Date.now();void writeJson(stateFile,state).catch(()=>{});},Math.max(0,2000-(Date.now()-lastWrite)));}
async function saveNow(){if(pending){clearTimeout(pending);pending=undefined;}if(state){lastWrite=Date.now();await writeJson(stateFile,state);}}
const ACTIVITY:Record<string,(sub?:string)=>string>={
 'thesis-options':()=>'Gravando as opções de tese',draft:()=>'Montando os slides (draft)',lint:()=>'Conferindo a copy (lint)',spine:()=>'Teste cego da spine',
 render:()=>'Renderizando os slides',review:()=>'Registrando a revisão visual',status:()=>'Conferindo o próximo passo',validate:()=>'Validando o carrossel',
 'fit-probe':()=>'Medindo o que cabe em cada composição',autofit:()=>'Ajustando os slides que não couberam',composition:()=>'Trocando uma composição',
 idea:()=>'Guardando teses no backlog',library:()=>'Consultando a biblioteca genética',slide:sub=>`Editando a estrutura (slide ${sub??''})`,
 image:()=>'Decidindo a imagem de um slide',asset:sub=>`Imagens (${sub??''})`,
};
function describe(name:string,input:any):string{
 if(name==='Bash'){const cmd=String(input?.command??''),m=cmd.match(/npm run (?:-s )?carousel -- ([a-z-]+)(?:\s+([a-z-]+))?/);return m?(ACTIVITY[m[1]]?.(m[2])??`carousel ${m[1]}`):`Terminal: ${cmd.slice(0,80)}`;}
 const f=String(input?.file_path??'');
 if(name==='Read')return f.endsWith('transcript.txt')?'Lendo a transcrição':f.includes(`${path.sep}editorial${path.sep}`)?`Lendo o guia ${path.basename(f,'.md')}`:f.includes('genetic-library')?`Estudando um carrossel publicado (${path.basename(f,'.yaml')})`:f.endsWith('.png')?`Conferindo ${path.basename(f)}`:`Lendo ${path.basename(f)}`;
 if(name==='Write'||name==='Edit'){const b=path.basename(f);return b==='editorial-report.md'?'Escrevendo o relatório editorial':b==='copy.md'?'Escrevendo a copy':b==='editorial.json'?'Escrevendo os metadados editoriais':`Escrevendo ${b}`;}
 if(name==='Task'||name==='Agent')return `Subagente: ${String(input?.description??'teste cego')}`;
 if(name==='WebSearch')return `Pesquisando: ${String(input?.query??'').slice(0,80)}`;
 if(name==='Skill')return 'Abrindo a Skill';
 if(name==='Glob'||name==='Grep')return 'Procurando nos arquivos';
 if(name.startsWith('mcp__corpus'))return 'Consultando o Corpus';
 return name;
}
// While the model generates a long block (the whole report in one Write, for instance), the partial events tell what
// is coming; the finished message then replaces it with the precise description.
const PENDING:Record<string,string>={thinking:'Pensando…',Write:'Escrevendo…',Edit:'Editando um arquivo…',Task:'Chamando um subagente…',Agent:'Chamando um subagente…'};
function handle(e:any){
 if(!state)return;
 if(e.type==='stream_event'){const b=e.event?.type==='content_block_start'?e.event.content_block:null,next=b?.type==='thinking'?PENDING.thinking:b?.type==='tool_use'?PENDING[String(b.name)]:undefined;if(next&&next!==state.activity){state.activity=next;touch();}return;}
 if(e.type==='system'&&e.subtype==='init'){if(typeof e.session_id==='string')state.session_id=e.session_id;void line(`Agente iniciado${e.model?` (${e.model})`:''}`);touch();}
 else if(e.type==='assistant')for(const c of e.message?.content??[]){
  if(c.type==='tool_use'){state.activity=describe(String(c.name),c.input);void line(state.activity);touch();}
  else if(c.type==='text'&&typeof c.text==='string'&&c.text.trim())void line('» '+c.text.trim().split('\n')[0]);
 }
 else if(e.type==='user')for(const c of e.message?.content??[])if(c.type==='tool_result'&&c.is_error){
  const text=typeof c.content==='string'?c.content:Array.isArray(c.content)?c.content.map((x:any)=>x.text??'').join(' '):'';void line('⚠ '+text.slice(0,300));
 }
}
type Run={code:number|null;signal:NodeJS.Signals|null;result:any;stderr:string};
function run(bin:string,prompt:string,config:ConfigData):Promise<Run>{return new Promise(resolve=>{
 const s=state!,outside=!(dir+path.sep).startsWith(path.resolve(ROOT)+path.sep);
 const args=['-p',prompt,'--output-format','stream-json','--verbose','--permission-mode','acceptEdits','--allowedTools',ALLOWED_TOOLS.join(','),
  ...(s.resume?['--resume',s.session_id]:['--session-id',s.session_id]),...(config.agent.model?['--model',config.agent.model]:[]),
  ...(config.agent.max_budget_usd?['--max-budget-usd',String(config.agent.max_budget_usd)]:[]),...(outside?['--add-dir',dir]:[])];
 let result:any=null,stderr='';
 child=spawn(bin,args,{cwd:ROOT,env:process.env,stdio:['ignore','pipe','pipe']});
 readline.createInterface({input:child.stdout!}).on('line',l=>{let e:any;try{e=JSON.parse(l);}catch{return;}if(e?.type==='result')result=e;else handle(e);});
 child.stderr!.on('data',d=>{stderr=(stderr+String(d)).slice(-4000);});
 const timer=setTimeout(()=>{timedOut=true;child?.kill('SIGTERM');},config.agent.timeout_minutes*60_000);
 child.on('error',err=>{stderr+=String(err.message);});
 child.on('close',(code,signal)=>{clearTimeout(timer);resolve({code,signal,result,stderr});});
});}
async function finish(r:Run,config:ConfigData){
 if(stopping||!state)return;
 const res=r.result;state.finished_at=new Date().toISOString();
 if(typeof res?.total_cost_usd==='number')state.cost_usd=res.total_cost_usd;if(typeof res?.num_turns==='number')state.turns=res.num_turns;
 if(typeof res?.result==='string'&&res.result.trim())state.summary=res.result.trim().slice(-1500);
 const denied=[...new Set<string>((res?.permission_denials??[]).map((d:any)=>d?.tool_name).filter(Boolean))];
 if(denied.length)await line(`Permissões negadas: ${denied.join(', ')}`);
 let error:string|undefined;
 if(timedOut)error=`Tempo esgotado (${config.agent.timeout_minutes} min; config.json agent.timeout_minutes)`;
 else if(!res)error=`O Claude Code terminou sem resultado (código ${r.code}${r.signal?`, sinal ${r.signal}`:''})${r.stderr.trim()?`: ${r.stderr.trim().slice(-600)}`:''}`;
 else if(res.is_error||res.subtype!=='success')error=/budget/i.test(String(res.subtype))?'Teto de gasto atingido (config.json agent.max_budget_usd)':String((res.errors??[]).join('; ')||res.result||res.subtype);
 if(!error&&state.stage==='thesis'){
  const options=await readOptions(dir).catch((e:Error)=>{error=`Opções de tese inválidas: ${e.message}`;return null;});
  if(options){state.status='waiting';state.activity='Aguardando a escolha da tese';}else error??='O agente terminou sem gravar as opções de tese';
 }else if(!error){
  const p=await loadProject(dir),manifest=await optionalJson(path.join(dir,'render-manifest.json'));
  if(!p.carousel.slides.length)error='O agente terminou sem criar os slides';
  else if(!manifest)error='O agente terminou sem renderizar os slides';
  else{state.status='done';state.activity='Carrossel pronto para revisar';const failed=manifest.slides.filter((x:any)=>!x.passed).length;if(failed)state.warning=`${failed} slide(s) ainda não couberam: ajustar no estúdio ou pedir compressão da copy`;}
 }
 if(error){state.status='failed';state.error=error.slice(0,1500);state.activity='Parou com erro';}
 await saveNow();
 await line(state.status==='failed'?`✗ ${state.error}`:state.status==='waiting'?'✓ Opções de tese prontas: escolher no estúdio':'✓ Carrossel pronto');
 await log(dir,'AGENT',`Etapa ${state.stage}: ${state.status}${state.cost_usd!==undefined?` (US$ ${state.cost_usd.toFixed(2)}, ${state.turns??'?'} turnos)`:''}${state.error?` — ${state.error.slice(0,200)}`:''}`);
}
for(const sig of ['SIGTERM','SIGINT'] as const)process.on(sig,()=>{
 stopping=true;child?.kill('SIGTERM');
 void (async()=>{if(state){state.status='stopped';state.finished_at=new Date().toISOString();state.activity='Interrompido';await saveNow().catch(()=>{});}await line('Interrompido');process.exit(0);})();
});
async function main(){
 state=AgentState.parse(await readJson(stateFile));state.pid=process.pid;await saveNow();
 const config=await loadConfig(),bin=await claudeBin();
 if(!bin)throw Error('Claude Code não encontrado: instala o Claude Code (comando claude) ou define CAROUSEL_CLAUDE_BIN');
 const prompt=agentPrompt(dir,state.stage,{choice:state.stage==='write'?await readChoice(dir):null,family:state.family});
 await line(`— Etapa ${STAGES[state.stage]} —`);
 let r=await run(bin,prompt,config);
 if(!stopping&&state.resume&&(r.result?.errors??[]).some((x:unknown)=>/no conversation found/i.test(String(x)))){
  await line('Sessão da etapa 1 não encontrada: seguindo numa sessão nova (o relatório editorial traz o contexto)');
  state.resume=false;state.session_id=randomUUID();r=await run(bin,prompt,config);
 }
 await finish(r,config);
}
main().catch(async e=>{
 const message=e instanceof Error?e.message:String(e);await line(`✗ ${message}`);
 if(state){state.status='failed';state.error=message.slice(0,1500);state.finished_at=new Date().toISOString();state.activity='Parou com erro';await saveNow().catch(()=>{});}
 await log(dir,'AGENT',`Falha do executor: ${message.slice(0,200)}`).catch(()=>{});process.exitCode=1;
});
