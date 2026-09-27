#!/usr/bin/env node
import path from 'node:path';
import { readFile, access } from 'node:fs/promises';
import { chromiumPath } from './render/browser.js';
import { loadConfig } from './project/config.js';
import { z } from 'zod';
import { createProject, importCopy } from './project/create.js';
import { ROOT, projectsDir, readJson, writeJson, loadProject, log, optionalJson, jsonHash } from './project/io.js';
import { lint } from './qa/lint.js';
import { render, validate, exportProject, review, renderInputs } from './render/render.js';
import { serve } from './preview/server.js';
import { listProjects } from './preview/api.js';
import { createVariant, promoteVariant } from './project/variants.js';
import { addAsset } from './project/assets.js';
import { draft, slideAdd, slideMove, slideRemove } from './project/draft.js';
import { proposeVoice, approveVoice } from './qa/voice.js';
import { addIdea, listIdeas } from './project/backlog.js';
import { loadEditorialLibrary, libraryStats } from './library/genetic.js';
import { gallery } from './render/gallery.js';
import { calibrate } from './render/calibrate.js';
const args=process.argv.slice(2),command=args.shift();
const flag=(name:string)=>{const i=args.indexOf('--'+name);return i<0?undefined:args[i+1];};
const required=(v:string|undefined,usage:string)=>{if(!v||v.startsWith('--'))throw Error(usage);return v;};
const project=()=>path.resolve(required(args[0],'Informe o caminho do projeto'));
const print=(data:unknown)=>console.log(typeof data==='string'?data:JSON.stringify(data,null,2));
const help=`Sistema de Carrosséis Diego Moreira · 0.1.0

npm run carousel -- <comando>
  new <slug> --source <arquivo.txt|corpus:ID|v1.json|copy> [--allow-conversation]
  import-copy <projeto> <copy.md>
  draft <projeto> <copy.md> [--meta editorial.json] [--reset-art]      (modo full)
  slide add <projeto> --headline <t> [--body <t>] [--role r] [--after id|0|--at n]
  slide move <projeto> <id> --to <n> | slide rm <projeto> <id>
  voice <projeto> [--render]            proposta "você" → "tu" em qa/voice-proposal.md
  approve <projeto> voice --by <nome> [--note <t>]   só com o aval explícito de Diego
  from-copy <slug> <copy.md> [--family editorial_clean|cinematic_condensed]
  variant <projeto> <nome> [--family cinematic_condensed]
  promote <projeto> <nome>
  lint <projeto> [--json] | spine <projeto> [--blind] | status <projeto>
  calibrate <projeto> --slide <n> --ref <png publicado> [--threshold 32]   compara render × publicado
  gallery [--image foto.jpg] [--out pasta]   todas as composições × famílias (gallery/)
  library validate | library stats       biblioteca genética (genetic-library/)
  idea add --thesis <t> --source <ref> --why <t> [--project <slug>] | idea list
  render <projeto> [--slides id,id]
  validate <projeto> [--json]
  review <projeto> --reviewer <nome> --note <nota> [--approved] [--human]
  export <projeto>
  preview <projeto> [--port 4321]
  asset add <projeto> <arquivo> --rights <licença/origem> [--slide id]
  asset list <projeto>
  log <projeto> <TAG> <mensagem>
  doctor

review registra uma inspeção visual real; não a executa automaticamente.
Sem --human conta como ciclo automático (limite em config.json qa.max_auto_revision_cycles).
Comandos das próximas fases estão listados em docs/STATUS.md.`;
try{
 switch(command){
 case 'new':print(await createProject(required(args[0],'new <slug> --source <arquivo|corpus:ID|copy>'),required(flag('source'),'Informe --source'),{allowConversation:args.includes('--allow-conversation')}));break;
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
 case 'voice':print(await proposeVoice(project(),{render:args.includes('--render')}));break;
 case 'approve':{const dir=project(),what=required(args[1],'approve <projeto> voice --by <nome>');if(what!=='voice')throw Error('Aprovações disponíveis: voice');print(await approveVoice(dir,required(flag('by'),'Informe --by com o nome de quem aprovou'),flag('note')??'',{allowOther:args.includes('--allow-other')}));break;}
 case 'variant':{const dir=await createVariant(project(),required(args[1],'Informe o nome da versão'),flag('family'));print(dir);break;}
 case 'promote':print(await promoteVariant(project(),required(args[1],'Informe o nome da versão')));break;
 case 'import-copy':await importCopy(project(),path.resolve(required(args[1],'Informe o arquivo de copy')));print('Copy importada e travada.');break;
 case 'lint':{const r=await lint(project());print(r);if(!r.passed)process.exitCode=1;break;}
 // --blind prints only the headlines: the input of the blind spine test (editorial/internal-headlines.md).
 case 'spine':{const {carousel}=await loadProject(project()),blind=args.includes('--blind');print(carousel.slides.map((s,i)=>blind?`P${i+1} ${s.headline}`:`P${i+1} [${s.id}] ${s.headline}${s.next_question?`\n     → ${s.next_question}`:''}`).join('\n'));break;}
 case 'calibrate':print(await calibrate(project(),Number(required(flag('slide'),'Informe --slide <n>')),path.resolve(required(flag('ref'),'Informe --ref <png publicado>')),{threshold:flag('threshold')?Number(flag('threshold')):undefined}));break;
 case 'gallery':print(await gallery({out:flag('out')?path.resolve(flag('out')!):undefined,image:flag('image')?path.resolve(flag('image')!):undefined}));break;
 case 'library':{const sub=args.shift();const {examples,errors}=await loadEditorialLibrary();if(sub==='validate'){print({examples:examples.length,errors});if(errors.length)process.exitCode=1;}else if(sub==='stats')print({...libraryStats(examples),errors});else throw Error('Disponíveis: library validate|stats');break;}
 case 'idea':{const sub=args.shift();if(sub==='add')print(await addIdea({thesis:flag('thesis'),source:flag('source'),why:flag('why'),project:flag('project')}));else if(sub==='list')print(await listIdeas());else throw Error('Disponíveis: idea add|list');break;}
 case 'render':{const r=await render(project(),flag('slides')?.split(','));print({render_hash:r.render_hash,slides:r.slides.map(s=>({id:s.id,passed:s.passed,errors:s.errors,...(s.warnings?.length?{warnings:s.warnings}:{})}))});if(r.slides.some(s=>!s.passed))process.exitCode=1;break;}
 case 'validate':{const r=await validate(project());print(r);if(!r.passed)process.exitCode=1;break;}
 case 'export':print(await exportProject(project()));break;
 case 'review':await review(project(),{name:required(flag('reviewer'),'Informe --reviewer'),kind:args.includes('--human')?'human':'agent'},required(flag('note'),'Informe --note com o resultado da inspeção visual'),args.includes('--approved'));print('Revisão registrada.');break;
 case 'status':{const dir=project(),p=await renderInputs(dir),l=await optionalJson(path.join(dir,'qa/editorial-lint.json')),r=await optionalJson(path.join(dir,'render-manifest.json')),v=await optionalJson(path.join(dir,'qa/visual-review.json'));print({project:dir,mode:p.carousel.project.mode,slides:p.carousel.slides.length,lint_current:!!l?.passed&&l.content_hash===jsonHash(p.carousel),render_current:r?.project_hash===p.project_hash,visual_review_current:!!v?.approved&&v.render_hash===r?.render_hash,source:p.carousel.source});break;}
 case 'preview':{let dir:string|null=args[0]&&!args[0].startsWith('--')?path.resolve(args[0]):null;if(!dir){const projects=await listProjects();dir=projects.length?path.join(projectsDir(),projects[0]):null;}const config=await loadConfig();const server=await serve(dir,Number(flag('port')??config.preview.port),true);print(server.url);for(const sig of ['SIGINT','SIGTERM'] as const)process.on(sig,()=>void server.close().then(()=>process.exit(0)));break;}
 case 'asset':{
  const sub=args.shift(),dir=project();
  if(sub==='list'){print((await loadProject(dir)).assets);break;}
  if(sub!=='add')throw Error('Disponíveis: asset add|list');
  const bytes=await readFile(path.resolve(required(args[1],'Informe o arquivo de imagem')));const result=await addAsset(dir,bytes,required(flag('rights'),'Informe --rights com origem e direitos'),flag('slide'));
  print(result);break;
 }
 case 'log':await log(project(),required(args[1],'Informe TAG'),required(args.slice(2).join(' '),'Informe mensagem'));break;
 case 'doctor':{
  const checks=[];
  checks.push({check:'Node 24 LTS',ok:process.versions.node.startsWith('24.'),detail:process.versions.node});
  for(const file of ['design/fonts/manifest.json','engine/schema/generated/carousel.schema.json']){try{await access(path.join(ROOT,file));checks.push({check:file,ok:true});}catch{checks.push({check:file,ok:false});}}
  try{await access(chromiumPath());checks.push({check:'Chromium instalado',ok:true,detail:chromiumPath()});}catch{checks.push({check:'Chromium instalado',ok:false});}
  const config=await loadConfig();checks.push({check:'Avatar oficial',ok:!!config.branding.avatar,optional:true});
  print({passed:checks.every(c=>c.ok||c.optional),checks});if(checks.some(c=>!c.ok&&!c.optional))process.exitCode=1;break;
 }
 case undefined:case 'help':case '--help':print(help);break;
 default:throw Error(`Comando desconhecido: ${command}. Usa --help.`);
 }
}catch(e){print({error:e instanceof z.ZodError?'Contrato inválido':e instanceof Error?e.message:String(e),...(e instanceof z.ZodError?{issues:e.issues}: {})});process.exitCode=1;}
