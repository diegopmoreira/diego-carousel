import http from 'node:http';
import { watch } from 'node:fs';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { ROOT, projectsDir, safeChild, contentDir, optionalJson, hash, withLock, LockedError, writeJson, readJson } from '../project/io.js';
import { state, adjust, revision, emptyState } from './api.js';
import { createVariant, promoteVariant, variantName } from '../project/variants.js';
import { createProject, importCopy } from '../project/create.js';
import { parseCopy } from '../source/copy.js';
import { addAsset } from '../project/assets.js';
import { loadConfig } from '../project/config.js';
import { workbenchHtml } from './page.js';
import { startAgent, stopAgent, chooseThesis, readAgentState, readOptions } from '../agent/editorial.js';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
const types:Record<string,string>={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.woff2':'font/woff2'};
// Static files are served from an exact allowlist. ZIPs, original uploads and project JSON go through the API only.
const STATIC:[RegExp,'design'|'dir'|'base'][]=[
 [/^\/design\/(base\.css|workbench\.css|workbench\.js|runtime\/(?:slide|linebreak)\.js|fonts\/fonts\.css|fonts\/[a-z0-9-]+\.woff2|brand\/[a-z0-9-]+\.png)$/,'design'],
 [/^\/project\/(html\/slide-\d{2}\.html|qa\/render\/\d{2}\.png|qa\/contact-sheet\.png|preview\/index\.html)$/,'dir'],
 [/^\/project\/(assets\/processed\/k[a-f0-9]{10}\.png)$/,'base'],
];
const CSP="default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'";
const same=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
async function body(req:http.IncomingMessage){const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>28*1024*1024)throw Error('Arquivo muito grande');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
export async function serve(initialDir:string|null,port=0,editable=false){
 const initialBase=initialDir?await contentDir(initialDir):null,token=randomBytes(24).toString('hex');let busy=false;
 const server=http.createServer(async(req,res)=>{
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':CSP,'X-Frame-Options':'SAMEORIGIN','Referrer-Policy':'same-origin'};
  const send=(status:number,value:unknown)=>{res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  const notFound=()=>{res.writeHead(404,{...headers,'Content-Type':'text/plain; charset=utf-8'});res.end('Não encontrado');};
  try{
   const port=(server.address() as import('node:net').AddressInfo).port,hosts=[`127.0.0.1:${port}`,`localhost:${port}`];
   if(!hosts.includes(req.headers.host??'')){send(403,{error:'Host inválido'});return;}
   const origin=`http://${req.headers.host}`,url=new URL(req.url??'/',origin);
   // Encoded separators or dots never name a file here; refusing them keeps decoding from escaping a folder.
   if(/%(2e|2f|5c|00)/i.test(url.pathname)||url.pathname.includes('\\')){notFound();return;}
   // Subresources of a slide shown in the studio iframe (its image) carry no query: take the project from the page
   // that asked for them. Referrer-Policy same-origin sends the referer only to this server.
   let context=url.searchParams;
   if(!context.has('project')&&!context.has('variant')&&req.headers.referer&&url.pathname.startsWith('/project/')){try{const ref=new URL(req.headers.referer);if(ref.origin===origin)context=ref.searchParams;}catch{}}
   const pathname=decodeURIComponent(url.pathname),variant=context.get('variant'),requestedProject=context.get('project');
   const base=requestedProject?safeChild(projectsDir(),variantName(requestedProject)):initialBase;
   if(requestedProject&&base&&await realpath(base)!==path.join(await realpath(projectsDir()),path.basename(base)))throw Error('Projeto inválido');
   const dir=base&&(variant?path.join(base,'variants',variantName(variant)):requestedProject?base:initialDir);
   if(pathname==='/'){
    if(!editable){res.writeHead(302,{...headers,Location:'/project/preview/index.html'});res.end();return;}
    res.writeHead(200,{...headers,'Content-Type':types['.html']});res.end(req.method==='HEAD'?undefined:workbenchHtml(''));return;
   }
   if(pathname.startsWith('/api/')){
    if(!editable){send(404,{error:'Preview somente leitura'});return;}
    if(req.method==='GET'&&pathname==='/api/state'){send(200,{...(dir?await state(dir):await emptyState()),token,busy});return;}
    // Server-sent events: one "change" per burst of writes to the project's documents or render.
    if(req.method==='GET'&&pathname==='/api/events'){
     if(!same(url.searchParams.get('token')??'',token)){send(403,{error:'Requisição não autorizada'});return;}
     if(!dir){send(404,{error:'Nenhum projeto aberto'});return;}
     res.writeHead(200,{...headers,'Content-Type':'text/event-stream; charset=utf-8',Connection:'keep-alive'});res.write('retry: 3000\n\n');
     let timer:NodeJS.Timeout|undefined;
     const relevant=(f:string|null)=>!!f&&/(^|[\\/])(carousel|art-direction|tweaks|render-manifest|approvals)\.json$|assets[\\/]manifest\.json$|qa[\\/](visual-review|voice-proposal|edit-proposal|agent|thesis-options|thesis-choice)\.json$|(^|[\\/])editorial-report\.md$/.test(f);
     const fire=(f:string|null)=>{if(!relevant(f))return;clearTimeout(timer);timer=setTimeout(()=>res.write(`event: change\ndata: ${JSON.stringify({file:f})}\n\n`),250);};
     // Directory watches (not recursive): documents are replaced by atomic renames, which per-file watches lose.
     const folders=[...new Set([dir,path.join(dir,'qa'),base!,path.join(base!,'qa'),path.join(base!,'assets')])];
     const watchers=folders.flatMap(d=>{try{return [watch(d,(_e,f)=>fire(f?path.join(path.relative(dir,d),String(f)):null))];}catch{return [];}});
     const ping=setInterval(()=>res.write(': ping\n\n'),25000);
     req.on('close',()=>{clearInterval(ping);clearTimeout(timer);watchers.forEach(w=>w.close());});
     return;
    }
    if(req.method==='GET'&&pathname==='/api/download'){
     if(!same(url.searchParams.get('token')??'',token)){send(403,{error:'Requisição não autorizada'});return;}
     if(!dir)throw Error('Nenhum projeto aberto');
     const {validate}=await import('../render/render.js');const valid=await validate(dir),receipt=await optionalJson(path.join(dir,'qa/export-receipt.json')),review=await optionalJson(path.join(dir,'qa/visual-review.json'));
     if(!valid.passed||!review?.approved||review.render_hash!==valid.render_hash||receipt?.render_hash!==valid.render_hash||receipt?.project_hash!==valid.project_hash)throw Error('Exportação ausente ou antiga. Exporta novamente.');
     const data=await readFile(path.join(dir,'qa/carrossel.zip'));if(hash(data)!==receipt.zip_hash)throw Error('Arquivo ZIP alterado. Exporta novamente.');
     res.writeHead(200,{...headers,'Content-Type':'application/zip','Content-Disposition':'attachment; filename="carrossel.zip"'});res.end(data);return;
    }
    if(req.method!=='POST'){send(405,{error:'Método não permitido'});return;}
    if(req.headers.origin!==origin||!same(String(req.headers['x-carousel-token']??''),token)){send(403,{error:'Requisição não autorizada'});return;}
    if(busy){send(409,{error:'Há uma atualização em andamento. Aguarda terminar.'});return;}
    // While the editorial agent writes this project, the studio only watches it (and can stop it).
    const agentPath=pathname.startsWith('/api/agent/');
    if(dir&&base&&!agentPath&&pathname!=='/api/create'&&(await readAgentState(base).catch(()=>null))?.status==='running'){send(409,{error:'O agente editorial está trabalhando neste projeto. Espera terminar ou interrompe.'});return;}
    busy=true;
    try{
     const input=await body(req);
     const {render,review,exportProject,buildPreview}=await import('../render/render.js');
     if(pathname==='/api/create'){
      const creation=z.object({revision:z.string().optional(),slug:z.string().max(60),source:z.enum(['copy','transcript']).default('copy'),copy:z.string().max(60000).optional(),transcript:z.string().max(800_000).optional(),corpus_id:z.string().max(64).optional(),confirm_public:z.boolean().optional(),by:z.string().trim().max(80).optional(),family:z.enum(['auto','editorial_clean','cinematic_condensed']),slides:z.number().int().min(6).max(15).nullable().optional()}).strict().parse(input);
      // From a transcript: the project keeps the transcript and the editorial agent writes the copy (Skill phases).
      if(creation.source==='transcript'){
       const corpus=creation.corpus_id?.trim(),pasted=creation.transcript?.trim()??'';
       if(!corpus&&pasted.length<300)throw Error('Cola a transcrição inteira (ou informa o ID do vídeo no Corpus)');
       // A pasted transcript has no Corpus record to check: Diego confirms it is his public video, without supervision.
       if(!corpus&&!creation.confirm_public)throw Error('Confirma que é um vídeo público de Diego, sem supervisão nem conversa com terceiros');
       let out:string;
       if(corpus)out=await createProject(creation.slug,`corpus:${corpus}`,{confirmPublic:!!creation.confirm_public});
       else{const tmp=await mkdtemp(path.join(os.tmpdir(),'carousel-paste-'));try{const file=path.join(tmp,'transcricao-colada.txt');await writeFile(file,pasted);out=await createProject(creation.slug,file);}finally{await rm(tmp,{recursive:true,force:true});}}
       if(creation.family!=='auto'){const art=await readJson(path.join(out,'art-direction.json'));art.family=creation.family;await writeJson(path.join(out,'art-direction.json'),art);}
       let warning;try{await startAgent(out,{family:creation.family,slides:creation.slides,by:creation.by??''});}catch(e){warning=e instanceof Error?e.message:String(e);}
       send(200,{project:path.basename(out),warning});return;
      }
      if(!creation.copy?.trim())throw Error('Cola a copy pronta');
      const {slides:range}=await loadConfig();
      const panels=parseCopy(creation.copy);if(panels.length<range.min||panels.length>range.max)throw Error(`A copy precisa de ${range.min} a ${range.max} painéis`);if(panels[0].body)throw Error('A capa deve conter só o título');
      const out=await createProject(creation.slug,'copy'),source=path.join(out,'source/input-copy.md');await writeFile(source,creation.copy);await importCopy(out,source);const art=await readJson(path.join(out,'art-direction.json'));art.family=creation.family==='auto'?'editorial_clean':creation.family;await writeJson(path.join(out,'art-direction.json'),art);await buildPreview(out,panels.length);
      let warning;try{await render(out);}catch(e){warning=e instanceof Error?e.message:String(e);}send(200,{project:path.basename(out),warning});return;
     }
     if(!dir||!base)throw Error('Nenhum projeto aberto');
     // The editorial agent (main project only): start or retry the next stage, Diego's thesis choice, stop.
     if(agentPath){
      if(dir!==base)throw Error('O agente trabalha no projeto principal: volta para a versão principal');
      if(pathname==='/api/agent/start'){z.object({revision:z.string().optional()}).strict().parse(input);await startAgent(base);}
      else if(pathname==='/api/agent/choose'){
       const pick=z.object({revision:z.string().optional(),options_hash:z.string(),thesis:z.string(),hook:z.string().nullable().optional(),hook_text:z.string().max(220).optional(),note:z.string().max(2000).optional(),by:z.string().trim().min(2).max(80)}).strict().parse(input);
       const {jsonHash}=await import('../project/io.js'),options=await readOptions(base);
       // Only the options Diego read: if the agent rewrote them after the page showed them, nothing starts.
       if(!options||jsonHash(options)!==pick.options_hash){send(409,{error:'As opções de tese mudaram depois que foram abertas. Confere de novo.'});return;}
       await chooseThesis(base,{thesis:pick.thesis,hook:pick.hook??null,hook_text:pick.hook_text,note:pick.note,by:pick.by});await startAgent(base,{stage:'write',by:pick.by});
      }else if(pathname==='/api/agent/stop'){await stopAgent(base);}
      else{send(404,{error:'Ação desconhecida'});return;}
      send(200,{...await state(dir),token,busy:false});return;
     }
     if(input.revision!==await revision(dir)){send(409,{error:'O projeto mudou em outra janela. Recarrega antes de salvar.'});return;}
     let warning:string|undefined;
     const done=await withLock(dir,async()=>{
      if(pathname==='/api/adjust'){await adjust(dir,input);await render(dir);}
      else if(pathname==='/api/render'){await render(dir);}
      else if(pathname==='/api/asset'){
       const upload=z.object({revision:z.string(),id:z.string(),rights:z.string().min(1),data:z.string().min(1)}).strict().parse(input);
       warning=(await addAsset(dir,Buffer.from(upload.data,'base64'),upload.rights,upload.id)).warning;await render(dir);
      }else if(pathname==='/api/variant'){
       const v=z.object({revision:z.string(),name:z.string(),family:z.enum(['editorial_clean','cinematic_condensed'])}).strict().parse(input);
       const out=await createVariant(dir,v.name,v.family);await render(out);send(200,{variant:v.name});return true;
      }else if(pathname==='/api/promote'){
       if(!variant)throw Error('Seleciona uma versão antes de torná-la principal');await withLock(base,async()=>{await promoteVariant(base,variant);await render(base);});send(200,{variant:null});return true;
      }else if(pathname==='/api/approve'){
       // Diego approves a pending voice or edit proposal on screen; the approval is recorded with the name given.
       const approval=z.object({revision:z.string(),type:z.enum(['voice','edit']),hash:z.string().regex(/^[a-f0-9]{64}$/),by:z.string().trim().min(2).max(80),confirmed:z.literal(true)}).strict().parse(input);
       // Only the proposal Diego read: if the file changed after the page showed it, nothing is applied.
       const {proposalHash}=await import('../qa/voice.js');
       if(await proposalHash(base,approval.type)!==approval.hash){send(409,{error:'A proposta mudou depois que foi aberta. Abre de novo e confere antes de aprovar.'});return true;}
       const {approveVoice,approveEdit}=await import('../qa/voice.js');
       // Diego read the whole proposal on screen (changes outside the rule are marked ⚠ there), so his approval
       // covers them. The copy lives in the main project, shared by every version: lock it and render it too.
       await withLock(base,async()=>{
        if(approval.type==='voice')await approveVoice(base,approval.by,'Aprovado no estúdio',{allowOther:true});else await approveEdit(base,approval.by,'');
        await render(base).catch(()=>{});
       });
       if(dir!==base)await render(dir).catch(()=>{});
      }else if(pathname==='/api/export'){
       const approval=z.object({revision:z.string(),confirmed:z.literal(true),reviewer:z.string().trim().min(2).max(80),note:z.string().min(5)}).strict().parse(input);
       await review(dir,{name:approval.reviewer,kind:'human'},approval.note,true);await exportProject(dir);
      }else{send(404,{error:'Ação desconhecida'});return true;}
      return false;
     });
     if(!done)send(200,{...await state(dir),token,busy:false,warning});
    }finally{busy=false;}
    return;
   }
   if(req.method!=='GET'&&req.method!=='HEAD'){send(405,{error:'Método não permitido'});return;}
   const route=STATIC.find(([pattern])=>pattern.test(pathname));
   if(!route){notFound();return;}
   const rel=pathname.match(route[0])![1],root=route[1]==='design'?path.join(ROOT,'design'):route[1]==='base'?base:dir;
   if(!root){notFound();return;}
   const file=safeChild(root,rel),actual=await realpath(file).catch(()=>null),actualRoot=await realpath(root);
   if(!actual||!actual.startsWith(actualRoot+path.sep)){notFound();return;}
   const bytes=await readFile(actual);res.writeHead(200,{...headers,'Content-Type':types[path.extname(actual)]??'application/octet-stream'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch(e){send(e instanceof LockedError?409:400,{error:e instanceof Error?e.message:String(e)});}
 });
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 return {url:`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`,token,close:()=>new Promise<void>((resolve,reject)=>{server.close(e=>e?reject(e):resolve());server.closeAllConnections();})};
}
