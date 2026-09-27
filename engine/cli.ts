#!/usr/bin/env node
import path from 'node:path';
import { readFile, access } from 'node:fs/promises';
import { chromiumPath, chromiumVersion } from './render/browser.js';
import { loadConfig } from './project/config.js';
import { VERSION } from './schema/index.js';
import { z } from 'zod';
import { createProject, importCopy } from './project/create.js';
import { ROOT, projectsDir, readJson, writeJson, loadProject, log, optionalJson, jsonHash, withLock, contentDir } from './project/io.js';
import { lint } from './qa/lint.js';
import { render, validate, exportProject, review, renderInputs, reviewCycles } from './render/render.js';
import { serve } from './preview/server.js';
import { listProjects } from './preview/api.js';
import { createVariant, promoteVariant } from './project/variants.js';
import { addAsset, chooseAsset, addVideoFrame } from './project/assets.js';
import { requestAsset, cancelRequest, addFromRequest } from './project/requests.js';
import { candidates } from './render/candidates.js';
import { draft, slideAdd, slideMove, slideRemove } from './project/draft.js';
import { proposeVoice, approveVoice, proposeEdit, approveEdit } from './qa/voice.js';
import { addIdea, listIdeas } from './project/backlog.js';
import { loadEditorialLibrary, libraryStats, libraryIndex } from './library/genetic.js';
import { gallery } from './render/gallery.js';
import { calibrate } from './render/calibrate.js';
import { fitProbe, autofit } from './render/fitprobe.js';
import { migrate, migrateAll } from './project/migrate.js';
import { setComposition } from './project/direction.js';
import { startAgent, stopAgent, agentView, chooseThesis, saveThesisOptions, claudeBin, AgentStage, readAgentState } from './agent/editorial.js';
const args=process.argv.slice(2),command=args.shift();
const flag=(name:string)=>{const i=args.indexOf('--'+name);return i<0?undefined:args[i+1];};
// Positional arguments, skipping flags and their values (boolean flags listed so their neighbour stays positional).
const BOOLEAN=new Set(['--need','--none','--json','--approved','--human','--blind','--reset-art','--render','--allow-other','--allow-conversation','--allow-unlisted','--confirm-public','--alternative','--all','--dry-run','--wait','--no-start']);
const positionals=()=>args.filter((a,i)=>!a.startsWith('--')&&!(i>0&&args[i-1].startsWith('--')&&!BOOLEAN.has(args[i-1])));
const required=(v:string|undefined,usage:string)=>{if(!v||v.startsWith('--'))throw Error(usage);return v;};
const project=()=>path.resolve(required(args[0],'Informe o caminho do projeto'));
const print=(data:unknown)=>console.log(typeof data==='string'?data:JSON.stringify(data,null,2));
const help=`Sistema de Carrosséis Diego Moreira · ${VERSION}

npm run carousel -- <comando>
  new <slug> --source <arquivo.txt|corpus:ID|v1.json|copy> [--allow-conversation] [--allow-unlisted] [--confirm-public]
  import-copy <projeto> <copy.md>
  draft <projeto> <copy.md> [--meta editorial.json] [--reset-art]      (modo full)
  slide add <projeto> --headline <t> [--body <t>] [--role r] [--after id|0|--at n]
  slide move <projeto> <id> --to <n> | slide rm <projeto> <id>
  voice <projeto> [--render]            proposta "você" → "tu" em qa/voice-proposal.md
  edit <projeto> <slide-id> [--headline t] [--body t] --reason t   proposta de edição de copy pronta
  approve <projeto> voice|edit --by <nome> [--note <t>]   só com o aval explícito de Diego
  from-copy <slug> <copy.md> [--family editorial_clean|cinematic_condensed]
  variant <projeto> <nome> [--family cinematic_condensed]
  promote <projeto> <nome>
  lint <projeto> [--json] | spine <projeto> [--blind] | status <projeto>
  calibrate <projeto> --slide <n> --ref <png publicado> [--threshold 32]   compara render × publicado
  gallery [--image foto.jpg] [--out pasta]   todas as composições × famílias (gallery/)
  library list [--architecture a] [--family f] | library validate | library stats   biblioteca genética
  idea add --thesis <t> --source <ref> --why <t> [--project <slug>] | idea list
  render <projeto> [--slides id,id]
  fit-probe <projeto> <slide-id>          composições que cabem, tamanhos e quanto cortar
  autofit <projeto>                       troca a composição dos slides que não cabem e renderiza
  composition <projeto> <slide-id> <composição>   troca a composição com posição, ajuste e imagem coerentes
  validate <projeto> [--json]
  review <projeto> --reviewer <nome> --note <nota> [--approved] [--human]
  export <projeto>
  preview <projeto> [--port 4321]
  asset add <projeto> <arquivo> --rights <licença/origem> [--slide id] [--alternative]
  asset request <projeto> <slide-id> [--variants n] [--concept t]   ticket de geração (prompt, teto)
  asset add <projeto> --request <pedido> (--url <u> | <arquivo>) [--seed s] [--model m] [--score n --rationale t]
  asset candidates <projeto> <slide-id> | asset choose <projeto> <slide-id> <asset-id> [--score n --rationale t]
  image <projeto> <slide-id> --need|--none   o slide exige imagem ou não usa imagem
  asset frame <projeto> <video> --at mm:ss [--slide id]   frame do próprio vídeo (ffmpeg)
  asset cancel <projeto> <pedido> | asset list <projeto>
  migrate <projeto> | migrate --all       atualiza projetos antigos aos contratos atuais
  agent start <projeto> [--stage thesis|write|full] [--family f] [--wait]   agente editorial (Claude Code) da transcrição ao render
  agent choose <projeto> --thesis t1 [--hook h1 | --hook-text t] [--note t] --by <nome> [--no-start] [--wait]
  agent status|stop <projeto>             progresso, log e parada do agente
  thesis-options <projeto> <arquivo.json>  (usado pelo agente) grava as opções de tese do checkpoint
  log <projeto> <TAG> <mensagem>
  doctor

review registra uma inspeção visual real; não a executa automaticamente.
Sem --human conta como ciclo automático (limite em config.json qa.max_auto_revision_cycles).
Estado e pendências: docs/STATUS.md · o que roda só no Mac: docs/sessao-local.md`;
try{
 switch(command){
 case 'new':print(await createProject(required(args[0],'new <slug> --source <arquivo|corpus:ID|copy>'),required(flag('source'),'Informe --source'),{allowConversation:args.includes('--allow-conversation'),allowUnlisted:args.includes('--allow-unlisted'),confirmPublic:args.includes('--confirm-public')}));break;
 case 'from-copy':{const dir=await createProject(required(args[0],'Informe o nome'), 'copy');await importCopy(dir,path.resolve(required(args[1],'Informe copy.md')));if(flag('family')){const {Family}=await import('./schema/index.js');const a=await readJson(path.join(dir,'art-direction.json'));a.family=Family.parse(flag('family'));await writeJson(path.join(dir,'art-direction.json'),a);}const result=await render(dir);print({project:dir,passed:result.slides.every(s=>s.passed)});if(result.slides.some(s=>!s.passed))process.exitCode=1;break;}
 case 'draft':print(await draft(project(),path.resolve(required(args[1],'draft <projeto> <copy.md> [--meta editorial.json] [--reset-art]')),flag('meta')?path.resolve(flag('meta')!):undefined,{resetArt:args.includes('--reset-art')}));break;
 case 'slide':{
  const sub=args.shift(),dir=project();
  if(sub==='add'){const at=flag('at');print(await slideAdd(dir,{headline:required(flag('headline'),'Informe --headline'),body:flag('body')??null,role:flag('role'),after:flag('after'),at:at?Number(at):undefined}));}
  else if(sub==='move')print(await slideMove(dir,required(args[1],'slide move <projeto> <id> --to <posição>'),Number(required(flag('to'),'Informe --to'))));
  else if(sub==='rm')print(await slideRemove(dir,required(args[1],'slide rm <projeto> <id>')));
  else throw Error('Disponíveis: slide add|move|rm');
  break;
 }
 case 'thesis-options':print(await saveThesisOptions(project(),path.resolve(required(args[1],'thesis-options <projeto> <arquivo.json>'))));break;
 case 'agent':{
  // The editorial agent from the terminal; the studio does the same through its buttons.
  const sub=args.shift(),dir=project(),wait=args.includes('--wait');
  if(sub==='start'){const stage=flag('stage'),family=flag('family');print(await startAgent(dir,{stage:stage?AgentStage.parse(stage):undefined,family:family?z.enum(['auto','editorial_clean','cinematic_condensed']).parse(family):undefined,by:flag('by')??''}));}
  else if(sub==='choose'){print(await chooseThesis(dir,{thesis:required(flag('thesis'),'Informe --thesis t1'),hook:flag('hook')??null,hook_text:flag('hook-text'),note:flag('note'),by:required(flag('by'),'Informe --by com o nome de quem escolheu')}));if(!args.includes('--no-start'))print(await startAgent(dir,{stage:'write',by:flag('by')}));}
  else if(sub==='status'){print(await agentView(dir));break;}
  else if(sub==='stop'){print(await stopAgent(dir));break;}
  else throw Error('Disponíveis: agent start|choose|status|stop <projeto>');
  if(wait){let last='';for(;;){const s=await readAgentState(dir);if(!s)break;if(s.activity!==last){last=s.activity;console.log(`… ${s.activity}`);}if(s.status!=='running'){print(await agentView(dir));if(s.status==='failed')process.exitCode=1;break;}await new Promise(r=>setTimeout(r,2000));}}
  break;
 }
 case 'composition':print(await setComposition(project(),required(args[1],'composition <projeto> <slide-id> <composição>'),required(args[2],'Informe a composição (full_bleed, cinematic_fade, image_card, text_only, giant_statement, minimal_pause, quote, contrast)')));break;
 case 'image':{
  // Explicit decision per slide: --need (export waits for an image) or --none (the slide does not use one).
  const dir=project(),slide=required(args[1],'image <projeto> <slide-id> --need|--none'),need=args.includes('--need')?true:args.includes('--none')?false:undefined;
  if(need===undefined)throw Error('Informe --need ou --none');
  const {adjust,revision}=await import('./preview/api.js');await withLock(dir,async()=>adjust(dir,{revision:await revision(dir),id:slide,image_need:need}));
  print({slide,image_need:need});break;
 }
 case 'voice':print(await proposeVoice(project(),{render:args.includes('--render')}));break;
 case 'edit':print(await proposeEdit(project(),required(args[1],'edit <projeto> <slide-id> [--headline t] [--body t] --reason t'),{headline:flag('headline'),body:flag('body'),reason:required(flag('reason'),'Informe --reason')}));break;
 case 'approve':{const dir=project(),what=required(args[1],'approve <projeto> voice|edit --by <nome>'),by=required(flag('by'),'Informe --by com o nome de quem aprovou');if(what==='voice')print(await approveVoice(dir,by,flag('note')??'',{allowOther:args.includes('--allow-other')}));else if(what==='edit')print(await approveEdit(dir,by,flag('note')??''));else throw Error('Aprovações disponíveis: voice, edit');break;}
 case 'variant':{const dir=await createVariant(project(),required(args[1],'Informe o nome da versão'),flag('family'));print(dir);break;}
 case 'promote':print(await promoteVariant(project(),required(args[1],'Informe o nome da versão')));break;
 case 'import-copy':await importCopy(project(),path.resolve(required(args[1],'Informe o arquivo de copy')));print('Copy importada e travada.');break;
 case 'lint':{const r=await lint(project());print(r);if(!r.passed)process.exitCode=1;break;}
 // --blind prints only the headlines: the input of the blind spine test (editorial/internal-headlines.md).
 case 'spine':{const {carousel}=await loadProject(project()),blind=args.includes('--blind');print(carousel.slides.map((s,i)=>blind?`P${i+1} ${s.headline}`:`P${i+1} [${s.id}] ${s.headline}${s.next_question?`\n     → ${s.next_question}`:''}`).join('\n'));break;}
 case 'fit-probe':print(await fitProbe(project(),required(args[1],'fit-probe <projeto> <slide-id>')));break;
 case 'autofit':{const dir=project(),r=await autofit(dir);if(r.changes.some(c=>c.changed))await render(dir);print(r);break;}
 case 'migrate':print(args[0]==='--all'?await migrateAll():await migrate(project()));break;
 case 'calibrate':print(await calibrate(project(),Number(required(flag('slide'),'Informe --slide <n>')),path.resolve(required(flag('ref'),'Informe --ref <png publicado>')),{threshold:flag('threshold')?Number(flag('threshold')):undefined}));break;
 case 'gallery':print(await gallery({out:flag('out')?path.resolve(flag('out')!):undefined,image:flag('image')?path.resolve(flag('image')!):undefined}));break;
 case 'library':{const sub=args.shift();const {examples,errors}=await loadEditorialLibrary();if(sub==='validate'){print({examples:examples.length,errors});if(errors.length)process.exitCode=1;}else if(sub==='list')print(libraryIndex(examples,{architecture:flag('architecture'),family:flag('family')}));else if(sub==='stats')print({...libraryStats(examples),errors});else throw Error('Disponíveis: library list|validate|stats');break;}
 case 'idea':{const sub=args.shift();if(sub==='add')print(await addIdea({thesis:flag('thesis'),source:flag('source'),why:flag('why'),project:flag('project')}));else if(sub==='list')print(await listIdeas());else throw Error('Disponíveis: idea add|list');break;}
 case 'render':{const r=await render(project(),flag('slides')?.split(','));print({render_hash:r.render_hash,...(r.rhythm_warnings?.length?{rhythm_warnings:r.rhythm_warnings}:{}),slides:r.slides.map(s=>({id:s.id,passed:s.passed,errors:s.errors,...(s.warnings?.length?{warnings:s.warnings}:{})}))});if(r.slides.some(s=>!s.passed))process.exitCode=1;break;}
 case 'validate':{const r=await validate(project());print(r);if(!r.passed)process.exitCode=1;break;}
 case 'export':print(await exportProject(project()));break;
 case 'review':await review(project(),{name:required(flag('reviewer'),'Informe --reviewer'),kind:args.includes('--human')?'human':'agent'},required(flag('note'),'Informe --note com o resultado da inspeção visual'),args.includes('--approved'));print('Revisão registrada.');break;
 case 'status':{
  // The ledger of a project for resuming work: what is current for the present content, and the next step.
  const dir=project(),p=await renderInputs(dir),l=await optionalJson(path.join(dir,'qa/editorial-lint.json')),r=await optionalJson(path.join(dir,'render-manifest.json')),v=await optionalJson(path.join(dir,'qa/visual-review.json'));
  const lintCurrent=!!l?.passed&&l.content_hash===jsonHash(p.carousel),renderCurrent=r?.project_hash===p.project_hash,renderPassed=renderCurrent&&r.slides.every((x:any)=>x.passed);
  const pendingImages=p.carousel.slides.filter(x=>{const d=p.art.slides[x.id];return (d?.image.need||d?.image.placeholder)&&!d?.image.asset_id;}).map(x=>x.id);
  const reviewCurrent=!!v&&v.render_hash===r?.render_hash&&renderCurrent,approved=reviewCurrent&&!!v.approved;
  const receipt=await optionalJson(path.join(dir,'qa/export-receipt.json')),exported=!!receipt&&!!r&&renderCurrent&&receipt.render_hash===r.render_hash;
  const {agentRenders,max}=await reviewCycles(dir),cyclesLeft=Math.max(0,max-agentRenders.size),humanNext=!reviewCurrent&&cyclesLeft===0&&!agentRenders.has(r?.render_hash);
  // Full mode: the editorial report says which phase comes next (the order of SKILL.md).
  const full=p.carousel.project.mode==='full',report=full?await readFile(path.join(await contentDir(dir),'editorial-report.md'),'utf8').catch(()=>''):'';
  const phase=([['Mapa da fonte','Fase 1'],['Diagnóstico','Fase 2'],['Teses','Fase 2'],['Hooks','Fase 3'],['Spine','Fase 4']] as const).find(([t])=>!report.includes(`## ${t}`));
  const next=!p.carousel.slides.length?(full?(phase?`editorial-report.md: escrever ## ${phase[0]} (${phase[1]})`:'escrever copy.md + editorial.json e rodar draft (Fase 5)'):'import-copy'):full&&!report.includes('## Teste cego')?'spine --blind → subagente → registrar ## Teste cego':!lintCurrent?'lint (corrigir erros)':!renderPassed?'render (e fit-probe/autofit nos que falham)':humanNext?'ciclos automáticos esgotados: Diego revisa no estúdio (preview) e exporta':!reviewCurrent?'abrir os PNGs e registrar review':pendingImages.length?`imagens pendentes em ${pendingImages.length} slide(s): asset request/add ou image --none`:!approved?'corrigir o que a revisão apontou e renderizar de novo':exported?'exportado':'validate e export';
  print({project:dir,mode:p.carousel.project.mode,slides:p.carousel.slides.length,lint_current:lintCurrent,render_current:renderCurrent,render_passed:renderPassed,pending_images:pendingImages,visual_review_current:reviewCurrent,approved,auto_review_cycles_left:cyclesLeft,exported,next,source:p.carousel.source});break;
 }
 case 'preview':{let dir:string|null=args[0]&&!args[0].startsWith('--')?path.resolve(args[0]):null;if(!dir){const projects=await listProjects();dir=projects.length?path.join(projectsDir(),projects[0]):null;}const config=await loadConfig();const server=await serve(dir,Number(flag('port')??config.preview.port),true);print(server.url);for(const sig of ['SIGINT','SIGTERM'] as const)process.on(sig,()=>void server.close().then(()=>process.exit(0)));break;}
 case 'asset':{
  const sub=args.shift(),dir=project(),num=(v?:string)=>v===undefined?undefined:Number(v);
  if(sub==='list'){print((await loadProject(dir)).assets);break;}
  if(sub==='request'){print(await requestAsset(dir,required(args[1],'asset request <projeto> <slide-id> [--variants n] [--concept texto]'),{variants:num(flag('variants')),concept:flag('concept'),provider:flag('provider'),model:flag('model')}));break;}
  if(sub==='cancel'){print(await cancelRequest(dir,required(args[1],'asset cancel <projeto> <pedido>')));break;}
  if(sub==='choose'){print(await chooseAsset(dir,required(args[1],'asset choose <projeto> <slide-id> <asset-id>'),required(args[2],'Informe o asset'),{score:num(flag('score')),rationale:flag('rationale')}));break;}
  if(sub==='frame'){print(await addVideoFrame(dir,path.resolve(required(args[1],'asset frame <projeto> <video> --at mm:ss [--slide id]')),required(flag('at'),'Informe --at mm:ss'),flag('slide')));break;}
  if(sub==='candidates'){print(await candidates(dir,required(args[1],'asset candidates <projeto> <slide-id>')));break;}
  if(sub!=='add')throw Error('Disponíveis: asset add|request|cancel|choose|candidates|frame|list');
  const request=flag('request');
  if(request){
   const rest=positionals().slice(1),file=rest[0]?path.resolve(rest[0]):undefined;
   print(await addFromRequest(dir,request,{url:flag('url'),bytes:file?await readFile(file):undefined},{seed:flag('seed'),model:flag('model'),params:flag('params')?JSON.parse(flag('params')!):undefined,score:num(flag('score')),rationale:flag('rationale')}));break;
  }
  const bytes=await readFile(path.resolve(required(args[1],'Informe o arquivo de imagem')));const result=await addAsset(dir,bytes,required(flag('rights'),'Informe --rights com origem e direitos'),flag('slide'),{alternative:args.includes('--alternative')});
  print(result);break;
 }
 case 'log':await log(project(),required(args[1],'Informe TAG'),required(args.slice(2).join(' '),'Informe mensagem'));break;
 case 'doctor':{
  const checks=[];
  checks.push({check:'Node 24 LTS',ok:process.versions.node.startsWith('24.'),detail:process.versions.node});
  for(const file of ['design/fonts/manifest.json','engine/schema/generated/carousel.schema.json']){try{await access(path.join(ROOT,file));checks.push({check:file,ok:true});}catch{checks.push({check:file,ok:false});}}
  try{await access(chromiumPath());checks.push({check:'Chromium instalado',ok:true,detail:`${await chromiumVersion()} · ${chromiumPath()}`});}catch{checks.push({check:'Chromium instalado',ok:false});}
  const config=await loadConfig();checks.push({check:'Avatar oficial',ok:!!config.branding.avatar,optional:true});
  // Optional: only the studio's "from a transcript" flow (and npm run eval) needs Claude Code on this machine.
  const bin=await claudeBin();checks.push({check:'Claude Code (transcrição → carrossel pelo estúdio)',ok:!!bin,optional:true,detail:bin??'instalar o Claude Code ou definir CAROUSEL_CLAUDE_BIN'});
  print({passed:checks.every(c=>c.ok||c.optional),checks});if(checks.some(c=>!c.ok&&!c.optional))process.exitCode=1;break;
 }
 case undefined:case 'help':case '--help':print(help);break;
 default:throw Error(`Comando desconhecido: ${command}. Usa --help.`);
 }
}catch(e){print({error:e instanceof z.ZodError?'Contrato inválido':e instanceof Error?e.message:String(e),...(e instanceof z.ZodError?{issues:e.issues}: {})});process.exitCode=1;}
