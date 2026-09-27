// Stand-in for `claude -p` in tests of the editorial agent: speaks the stream-json protocol and does, with the full-mode
// fixture, what the agent does in each stage. Never used outside tests (CAROUSEL_CLAUDE_BIN points at a wrapper).
// FAKE_CLAUDE=fail → error result · slow → waits (to be stopped) · no-session → resume fails like an unknown session.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const argv=process.argv.slice(2),arg=n=>{const i=argv.indexOf(n);return i<0?undefined:argv[i+1];};
const prompt=arg('-p')??'',resume=arg('--resume'),session=resume??arg('--session-id')??'00000000-0000-4000-8000-000000000001',mode=process.env.FAKE_CLAUDE??'';
const emit=e=>process.stdout.write(JSON.stringify({...e,session_id:session})+'\n');
const result=(extra={})=>emit({type:'result',subtype:'success',is_error:false,num_turns:3,total_cost_usd:0,result:'ok',permission_denials:[],...extra});
const tool=(name,input)=>emit({type:'assistant',message:{content:[{type:'tool_use',name,input}]}});
const ROOT=process.cwd(),node=process.env.CAROUSEL_TEST_NODE||process.execPath;
const carousel=(...a)=>{tool('Bash',{command:`npm run carousel -- ${a.join(' ')}`});const r=spawnSync(node,['--import','tsx','engine/cli.ts',...a],{cwd:ROOT,env:process.env,encoding:'utf8'});if(r.status!==0)throw Error(`carousel ${a[0]}: ${r.stdout}${r.stderr}`);return r.stdout;};
if(resume&&mode==='no-session'){result({subtype:'error_during_execution',is_error:false,total_cost_usd:0,result:'',errors:[`No conversation found with session ID: ${resume}`]});process.exit(0);}
emit({type:'system',subtype:'init',model:'fake-claude'});
if(mode==='slow'){setTimeout(()=>{},60_000);}
else if(mode==='fail'){emit({type:'assistant',message:{content:[{type:'text',text:'Não consegui ler a transcrição.'}]}});result({subtype:'error_during_execution',is_error:true,result:'Falha simulada'});}
else{
 const dir=prompt.match(/no projeto (\S+) \(modo full\)/)?.[1];if(!dir)throw Error('projeto ausente no prompt');
 const report=path.join(dir,'editorial-report.md'),fixture=path.join(ROOT,'fixtures/full');
 if(/Etapa 1 de 2/.test(prompt)){
  tool('Read',{file_path:path.join(dir,'source/transcript.txt')});
  const full=readFileSync(path.join(fixture,'editorial-report.md'),'utf8');writeFileSync(report,full.slice(0,full.indexOf('## Spine')));tool('Write',{file_path:report});
  const tmp=path.join(mkdtempSync(path.join(os.tmpdir(),'fake-claude-')),'opcoes.json');
  writeFileSync(tmp,JSON.stringify({schema_version:1,theses:[{id:'t1',text:'A sede é legítima; o problema é beber água salgada.',why:'É a formulação mais forte da fonte.'},{id:'t2',text:'Carência não se cura, se educa.',why:'Fecha com uma ação.'},{id:'t3',text:'Atenção barata não é amor.',why:'Contraste claro.'}],hooks:[{id:'h1',text:'A sede é legítima. O erro é beber água salgada',family:'reframe'},{id:'h2',text:'Tu não tem carência demais',family:'negação'},{id:'h3',text:'Por que a poça nunca mata a sede',family:'pergunta'}],recommended:{thesis:'t1',hook:'h1'}}));
  carousel('thesis-options',dir,tmp);result({result:'Tese recomendada: t1; hook h1.'});
 }else{
  copyFileSync(path.join(fixture,'editorial-report.md'),report);tool('Write',{file_path:report});
  copyFileSync(path.join(fixture,'copy.md'),path.join(dir,'copy.md'));copyFileSync(path.join(fixture,'editorial.json'),path.join(dir,'editorial.json'));tool('Write',{file_path:path.join(dir,'copy.md')});
  carousel('draft',dir,path.join(dir,'copy.md'),'--meta',path.join(dir,'editorial.json'));carousel('lint',dir);carousel('render',dir);
  carousel('review',dir,'--reviewer','Claude','--note','Teste automático: leitura e ritmo conferidos.');
  result({result:'Tese: a sede é legítima. 10 painéis. Imagens pendentes: 3.'});
 }
}
