import http from 'node:http';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { ROOT, safeChild, contentDir, optionalJson, hash } from '../project/io.js';
import { state, adjust, revision } from './api.js';
import { createVariant, promoteVariant, variantName } from '../project/variants.js';
import { createProject, importCopy } from '../project/create.js';
import { parseCopy } from '../source/copy.js';
import { writeJson, readJson } from '../project/io.js';
import { addAsset } from '../project/assets.js';
const types:Record<string,string>={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json','.zip':'application/zip'};
async function body(req:http.IncomingMessage){const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>28*1024*1024)throw Error('Arquivo muito grande');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
export async function serve(initialDir:string,port=0,editable=false){
 const initialBase=await contentDir(initialDir),token=randomBytes(24).toString('hex');let busy=false;
 const server=http.createServer(async(req,res)=>{
  const send=(status:number,value:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  try{
   const host=`127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`,origin=`http://${host}`;
   if(req.headers.host!==host){send(403,{error:'Host inválido'});return;}
   const url=new URL(req.url??'/',origin),pathname=decodeURIComponent(url.pathname),variant=url.searchParams.get('variant');
   const requestedProject=url.searchParams.get('project');
   const base=requestedProject?safeChild(path.join(ROOT,'projects'),variantName(requestedProject)):initialBase;
   if(requestedProject&&await realpath(base)!==base)throw Error('Projeto inválido');
   const dir=variant?path.join(base,'variants',variantName(variant)):requestedProject?base:initialDir;
   if(pathname.startsWith('/api/')){
    if(!editable){send(404,{error:'Preview somente leitura'});return;}
    if(req.method==='GET'&&pathname==='/api/state'){send(200,{...await state(dir),token,busy});return;}
    if(req.method==='GET'&&pathname==='/api/download'){
     const {validate}=await import('../render/render.js');const valid=await validate(dir),receipt=await optionalJson(path.join(dir,'qa/export-receipt.json')),review=await optionalJson(path.join(dir,'qa/visual-review.json'));
     if(!valid.passed||!review?.approved||review.render_hash!==valid.render_hash||receipt?.render_hash!==valid.render_hash||receipt?.project_hash!==valid.project_hash)throw Error('Exportação ausente ou antiga. Exporta novamente.');
     const data=await readFile(path.join(dir,'qa/carrossel.zip'));if(hash(data)!==receipt.zip_hash)throw Error('Arquivo ZIP alterado. Exporta novamente.');
     res.writeHead(200,{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="carrossel.zip"','Cache-Control':'no-store'});res.end(data);return;
    }
    if(req.method!=='POST'){send(405,{error:'Método não permitido'});return;}
    if(req.headers.origin!==origin||req.headers['x-carousel-token']!==token){send(403,{error:'Requisição não autorizada'});return;}
    if(busy){send(409,{error:'Há uma atualização em andamento. Aguarda terminar.'});return;}
    busy=true;
    try{
     const input=await body(req);
     if(input.revision!==await revision(dir)){send(409,{error:'O projeto mudou em outra janela. Recarrega antes de salvar.'});return;}
     const {render,review,exportProject,buildPreview}=await import('../render/render.js');
     if(pathname==='/api/create'){
      const creation=z.object({revision:z.string(),slug:z.string().max(60),copy:z.string().min(1).max(60000),family:z.enum(['editorial_clean','cinematic_condensed'])}).strict().parse(input);
      const panels=parseCopy(creation.copy);if(panels.length<8||panels.length>12)throw Error('A copy precisa de 8 a 12 painéis');if(panels[0].body)throw Error('A capa deve conter só o título');
      const out=await createProject(creation.slug,'copy'),source=path.join(out,'source/input-copy.md');await writeFile(source,creation.copy);await importCopy(out,source);const art=await readJson(path.join(out,'art-direction.json'));art.family=creation.family;await writeJson(path.join(out,'art-direction.json'),art);await buildPreview(out,panels.length);
      let warning;try{await render(out);}catch(e){warning=e instanceof Error?e.message:String(e);}send(200,{project:path.basename(out),warning});return;
     }else if(pathname==='/api/adjust'){await adjust(dir,input);await render(dir);}
     else if(pathname==='/api/render'){await render(dir);}
     else if(pathname==='/api/asset'){
      const upload=z.object({revision:z.string(),id:z.string(),rights:z.string().min(1),data:z.string().min(1)}).strict().parse(input);
      await addAsset(dir,Buffer.from(upload.data,'base64'),upload.rights,upload.id);await render(dir);
     }else if(pathname==='/api/variant'){
      const v=z.object({revision:z.string(),name:z.string(),family:z.enum(['editorial_clean','cinematic_condensed'])}).strict().parse(input);
      const out=await createVariant(dir,v.name,v.family);await render(out);send(200,{variant:v.name});return;
     }else if(pathname==='/api/promote'){
      if(!variant)throw Error('Seleciona uma versão antes de torná-la principal');await promoteVariant(base,variant);await render(base);send(200,{variant:null});return;
     }else if(pathname==='/api/export'){
      const approval=z.object({revision:z.string(),confirmed:z.literal(true),note:z.string().min(5)}).strict().parse(input);
      await review(dir,'Diego',approval.note,true);await exportProject(dir);
     }else{send(404,{error:'Ação desconhecida'});return;}
     send(200,{...await state(dir),token,busy:false});
    }finally{busy=false;}
    return;
   }
   if(req.method!=='GET'&&req.method!=='HEAD'){send(405,{error:'Método não permitido'});return;}
   let root:string,rel:string;
   if(pathname.startsWith('/design/')){root=path.join(ROOT,'design');rel=pathname.slice(8);}
   else if(/^\/project\/(html|assets|export|qa|preview)\//.test(pathname)){root=pathname.startsWith('/project/assets/')?base:dir;rel=pathname.slice(9);}
   else if(pathname==='/'){res.writeHead(302,{Location:'/project/preview/index.html'+url.search});res.end();return;}
   else{res.writeHead(404);res.end('Não encontrado');return;}
   const file=safeChild(root,rel),actual=await realpath(file),actualRoot=await realpath(root);
   if(!actual.startsWith(actualRoot+path.sep))throw Error('Caminho inválido');
   const bytes=await readFile(actual);res.writeHead(200,{'Content-Type':types[path.extname(actual)]??'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch(e){send(400,{error:e instanceof Error?e.message:String(e)});}
 });
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 return {url:`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`,close:()=>new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()))};
}
