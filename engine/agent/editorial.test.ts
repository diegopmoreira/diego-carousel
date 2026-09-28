import { agentEnv } from './runner.js';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile, chmod, readFile } from 'node:fs/promises';
import path from 'node:path'; import os from 'node:os';
import { ROOT, writeJson, loadProject } from '../project/io.js';
import { createProject } from '../project/create.js';
import { agentPrompt, startAgent, stopAgent, readAgentState, agentView, chooseThesis, ThesisOptions } from './editorial.js';
// The agent runs against a stand-in for `claude -p` (scripts/fake-claude.mjs): same protocol, fixture content.
let work='';
beforeAll(async()=>{
 work=await mkdtemp(path.join(os.tmpdir(),'agent-test-'));
 process.env.CAROUSEL_PROJECTS_DIR=path.join(work,'projects');process.env.CAROUSEL_CORPUS_DIR=path.join(ROOT,'fixtures/corpus');
 const bin=path.join(work,'claude');await writeFile(bin,`#!/bin/sh\nexec "${process.execPath}" "${path.join(ROOT,'scripts/fake-claude.mjs')}" "$@"\n`);await chmod(bin,0o755);
 process.env.CAROUSEL_CLAUDE_BIN=bin;process.env.CAROUSEL_TEST_NODE=process.execPath;
});
afterAll(async()=>{delete process.env.FAKE_CLAUDE;await rm(work,{recursive:true,force:true});});
async function settle(dir:string,timeout=90_000){
 const start=Date.now();
 for(;;){const s=await readAgentState(dir);if(s&&s.status!=='running')return s;if(Date.now()-start>timeout)throw Error('agente não terminou');await new Promise(r=>setTimeout(r,250));}
}
it('prompts por etapa e contrato das opções de tese',()=>{
 const thesis=agentPrompt('/p/x','thesis');expect(thesis).toMatch(/Etapa 1 de 2/);expect(thesis).toMatch(/thesis-options \/p\/x/);expect(thesis).toMatch(/Não faça perguntas/);
 expect(agentPrompt('/p/x','full',{family:'cinematic_condensed'})).toMatch(/Sem checkpoint[\s\S]*Família visual escolhida por Diego no estúdio: cinematic_condensed/);
 expect(()=>agentPrompt('/p/x','write')).toThrow(/escolha/);
 const write=agentPrompt('/p/x','write',{choice:{schema_version:1,thesis:'t2',thesis_text:'Carência não se cura, se educa.',hook:null,hook_text:'',note:'mais seco',by:'Diego',options_hash:'x',at:''}});
 expect(write).toMatch(/refaça ## Hooks/);expect(write).toMatch(/Nota de Diego: "mais seco"/);expect(write).toMatch(/Não exporte/);
 const ok={schema_version:1,theses:[{id:'t1',text:'Uma tese com texto suficiente',why:'porque sim'},{id:'t2',text:'Outra tese com texto suficiente',why:'porque sim'}],hooks:[1,2,3].map(n=>({id:`h${n}`,text:`Hook número ${n}`,family:''})),recommended:{thesis:'t1',hook:'h1'}};
 expect(ThesisOptions.safeParse(ok).success).toBe(true);
 expect(ThesisOptions.safeParse({...ok,recommended:{thesis:'t9',hook:'h1'}}).success).toBe(false);
 expect(ThesisOptions.safeParse({...ok,theses:[ok.theses[0]]}).success).toBe(false);
});
it('transcrição → opções de tese → escolha de Diego → etapa 2 retomando a sessão → carrossel renderizado',async()=>{
 const dir=await createProject('agente','corpus:exemplo-publico');
 const first=await startAgent(dir,{by:'Diego'});expect(first.stage).toBe('thesis');
 await expect(startAgent(dir)).rejects.toThrow(/já está trabalhando/);
 const waiting=await settle(dir);expect(waiting.status).toBe('waiting');
 const view=(await agentView(dir))!;expect(view.options?.theses).toHaveLength(3);expect(view.phases.find(p=>p.id==='hooks')?.done).toBe(true);expect(view.phases.find(p=>p.id==='copy')?.done).toBe(false);
 await expect(chooseThesis(dir,{thesis:'t2',hook:'h1',by:'Diego'})).rejects.toThrow(/tese recomendada/);
 await chooseThesis(dir,{thesis:'t1',hook:'h2',note:'mais seco',by:'Diego'});
 const second=await startAgent(dir);expect(second).toMatchObject({stage:'write',resume:true,session_id:waiting.session_id});
 const done=await settle(dir);expect(done.status,done.error).toBe('done');expect(done.summary).toMatch(/10 painéis/);
 expect((await loadProject(dir)).carousel.slides).toHaveLength(10);
 const log=await readFile(path.join(dir,'qa/agent.log'),'utf8');expect(log).toMatch(/Opções de tese prontas/);expect(log).toMatch(/Montando os slides/);expect(log).toMatch(/Carrossel pronto/);
 expect((await agentView(dir))!.phases.every(p=>p.done)).toBe(true);
},180_000);
it('falha, sessão perdida, parada e processo morto aparecem no estado',async()=>{
 const dir=await createProject('agente-falhas','corpus:exemplo-publico');
 process.env.FAKE_CLAUDE='fail';await startAgent(dir);let s=await settle(dir);expect(s.status).toBe('failed');expect(s.error).toMatch(/Falha simulada/);
 process.env.FAKE_CLAUDE='';await startAgent(dir);s=await settle(dir);expect(s.status).toBe('waiting');
 await chooseThesis(dir,{thesis:'t3',hook_text:'Atenção barata não é amor',by:'Diego'});
 // Stage 2 cannot resume the lost session: it starts a new one and still finishes.
 process.env.FAKE_CLAUDE='no-session';await startAgent(dir,{stage:'write'});s=await settle(dir);expect(s.status,s.error).toBe('done');expect(s.resume).toBe(false);
 expect(await readFile(path.join(dir,'qa/agent.log'),'utf8')).toMatch(/Sessão da etapa 1 não encontrada/);
 process.env.FAKE_CLAUDE='slow';const slow=await startAgent(dir,{stage:'thesis'});
 for(let i=0;i<40&&!(await readAgentState(dir))?.pid;i++)await new Promise(r=>setTimeout(r,100));
 expect((await stopAgent(dir)).status).toBe('stopped');
 await new Promise(r=>setTimeout(r,500));expect((await readAgentState(dir))?.status).toBe('stopped');
 expect(()=>process.kill(slow.pid!,0)).toThrow();
 // A runner that died without writing its state is reported as failed.
 await writeJson(path.join(dir,'qa/agent.json'),{...s,status:'running',pid:999999,started_at:new Date().toISOString()});
 expect((await readAgentState(dir))?.status).toBe('failed');
 process.env.FAKE_CLAUDE='';
},180_000);
describe('ambiente do agente',()=>{
 it('não herda as marcas de uma sessão do Claude Code (senão o claude recusa rodar aninhado)',()=>{
  const env=agentEnv({PATH:'/bin',HOME:'/h',CLAUDECODE:'1',CLAUDE_CODE_ENTRYPOINT:'cli',CAROUSEL_CLAUDE_BIN:'/x'});
  expect(env).toEqual({PATH:'/bin',HOME:'/h',CAROUSEL_CLAUDE_BIN:'/x'});
 });
});
