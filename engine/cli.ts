#!/usr/bin/env node
import path from 'node:path';
import { readFile, writeFile, access, readdir } from 'node:fs/promises';
import sharp from 'sharp';
import { chromiumPath } from './render/browser.js';
import { loadConfig } from './project/config.js';
import { z } from 'zod';
import { createProject, importCopy } from './project/create.js';
import { ROOT, projectsDir, readJson, writeJson, loadProject, opaqueId, hash, log, optionalJson, jsonHash } from './project/io.js';
import { lint } from './qa/lint.js';
import { render, validate, exportProject, review, renderInputs } from './render/render.js';
import { serve } from './preview/server.js';
import { listProjects } from './preview/api.js';
import { createVariant, promoteVariant } from './project/variants.js';
import { addAsset } from './project/assets.js';
import { Assets } from './schema/index.js';
const args=process.argv.slice(2),command=args.shift();
const flag=(name:string)=>{const i=args.indexOf('--'+name);return i<0?undefined:args[i+1];};
const required=(v:string|undefined,usage:string)=>{if(!v||v.startsWith('--'))throw Error(usage);return v;};
const project=()=>path.resolve(required(args[0],'Informe o caminho do projeto'));
const print=(data:unknown)=>console.log(typeof data==='string'?data:JSON.stringify(data,null,2));
const help=`Sistema de Carrosséis Diego Moreira · 0.1.0

npm run carousel -- <comando>
  new <slug> --source <arquivo.txt|copy>
  import-copy <projeto> <copy.md>
  from-copy <slug> <copy.md> [--family editorial_clean|cinematic_condensed]
  variant <projeto> <nome> [--family cinematic_condensed]
  promote <projeto> <nome>
  lint <projeto> [--json] | spine <projeto> | status <projeto>
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
 case 'new':print(await createProject(required(args[0],'new <slug> --source <arquivo|copy>'),required(flag('source'),'Informe --source')));break;
 case 'from-copy':{const dir=await createProject(required(args[0],'Informe o nome'), 'copy');await importCopy(dir,path.resolve(required(args[1],'Informe copy.md')));if(flag('family')){const {Family}=await import('./schema/index.js');const a=await readJson(path.join(dir,'art-direction.json'));a.family=Family.parse(flag('family'));await writeJson(path.join(dir,'art-direction.json'),a);}const result=await render(dir);print({project:dir,passed:result.slides.every(s=>s.passed)});if(result.slides.some(s=>!s.passed))process.exitCode=1;break;}
 case 'variant':{const dir=await createVariant(project(),required(args[1],'Informe o nome da versão'),flag('family'));print(dir);break;}
 case 'promote':print(await promoteVariant(project(),required(args[1],'Informe o nome da versão')));break;
 case 'import-copy':await importCopy(project(),path.resolve(required(args[1],'Informe o arquivo de copy')));print('Copy importada e travada.');break;
 case 'lint':{const r=await lint(project());print(r);if(!r.passed)process.exitCode=1;break;}
 case 'spine':{const {carousel}=await loadProject(project());print(carousel.slides.map((s,i)=>`P${i+1} [${s.id}] ${s.headline}`).join('\n'));break;}
 case 'render':{const r=await render(project(),flag('slides')?.split(','));print({render_hash:r.render_hash,slides:r.slides.map(s=>({id:s.id,passed:s.passed,errors:s.errors}))});if(r.slides.some(s=>!s.passed))process.exitCode=1;break;}
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
