import { readFile, writeFile, mkdir, rename, open, rm } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Carousel, ArtDirection, Tweaks, Assets } from '../schema/index.js';
export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
// Tests point CAROUSEL_PROJECTS_DIR at a temporary folder so they never touch real projects.
export const projectsDir=()=>path.resolve(process.env.CAROUSEL_PROJECTS_DIR||path.join(ROOT,'projects'));
export const opaqueId = () => 'k'+randomBytes(5).toString('hex');
export const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const jsonHash = (value: unknown) => hash(JSON.stringify(value));
export async function readJson(file:string) { return JSON.parse(await readFile(file,'utf8')); }
export async function writeJson(file:string, value:unknown) {await mkdir(path.dirname(file),{recursive:true}); const tmp=`${file}.${randomBytes(4).toString('hex')}.tmp`; await writeFile(tmp,JSON.stringify(value,null,2)+'\n'); await rename(tmp,file);}
export async function optionalJson(file:string) {try{return await readJson(file);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}}
export async function contentDir(dir:string){
 const marker=await optionalJson(path.join(dir,'variant.json'));
 if(!marker)return dir;
 if(path.basename(path.dirname(dir))!=='variants'||marker.name!==path.basename(dir))throw Error('Diretório de versão inválido');
 return path.resolve(dir,'../..');
}
export async function loadProject(dir:string) {
 const base=await contentDir(dir);
 const [c,a,t,m]=await Promise.all([readJson(path.join(base,'carousel.json')),readJson(path.join(dir,'art-direction.json')),readJson(path.join(dir,'tweaks.json')),readJson(path.join(base,'assets/manifest.json'))]);
 return {carousel:Carousel.parse(c),art:ArtDirection.parse(a),tweaks:Tweaks.parse(t),assets:Assets.parse(m)};
}
export async function log(dir:string,tag:string,message:string){await writeFile(path.join(dir,'run.log'),`${new Date().toISOString()} [${tag.replace(/[^A-Z_]/g,'')}] ${message.replace(/\n/g,' ')}\n`,{flag:'a'});}
export function safeChild(dir:string,relative:string){const p=path.resolve(dir,relative);if(!p.startsWith(path.resolve(dir)+path.sep))throw Error('Caminho fora do projeto');return p;}
// Cross-process write lock shared by the CLI and the studio. Nested calls in the same async flow pass through;
// a lock left by a dead process is reclaimed.
const held=new AsyncLocalStorage<Set<string>>();
export async function withLock<T>(dir:string,fn:()=>Promise<T>):Promise<T>{
 const file=path.resolve(dir,'.lock'),mine=held.getStore();
 if(mine?.has(file))return fn();
 for(let attempt=0;;attempt++){
  try{const h=await open(file,'wx');await h.writeFile(JSON.stringify({pid:process.pid,at:new Date().toISOString()}));await h.close();break;}
  catch(e){
   if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;
   const owner=await optionalJson(file).catch(()=>null);
   let alive=false;if(owner?.pid){try{process.kill(owner.pid,0);alive=true;}catch(err){alive=(err as NodeJS.ErrnoException).code==='EPERM';}}
   if(alive||attempt>0)throw new LockedError(owner?.pid);
   await rm(file,{force:true});
  }
 }
 try{return await held.run(new Set([...(mine??[]),file]),fn);}finally{await rm(file,{force:true});}
}
export class LockedError extends Error{constructor(pid?:number){super(`Projeto em uso por outro processo${pid?` (pid ${pid})`:''}. Aguarda terminar.`);}}
