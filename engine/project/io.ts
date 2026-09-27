import { readFile, writeFile, mkdir, rename, link, rm } from 'node:fs/promises';
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
// Project documents always point at their JSON Schema, relative to where they live (projects, variants or tests).
const SCHEMAS:Record<string,string>={'carousel.json':'carousel','art-direction.json':'art-direction','tweaks.json':'tweaks','manifest.json':'assets'};
function withSchema(file:string,value:unknown){
 const name=SCHEMAS[path.basename(file)];
 if(!name||!value||typeof value!=='object'||Array.isArray(value)||!('schema_version' in value))return value;
 if(name==='assets'&&path.basename(path.dirname(file))!=='assets')return value;
 const ref=path.relative(path.dirname(file),path.join(ROOT,`engine/schema/generated/${name}.schema.json`)).split(path.sep).join('/');
 const {$schema:_,...rest}=value as Record<string,unknown>;return {$schema:ref,...rest};
}
export async function writeJson(file:string, value:unknown) {value=withSchema(file,value);await mkdir(path.dirname(file),{recursive:true}); const tmp=`${file}.${randomBytes(4).toString('hex')}.tmp`; await writeFile(tmp,JSON.stringify(value,null,2)+'\n'); await rename(tmp,file);}
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
const alive=(pid:number)=>{try{process.kill(pid,0);return true;}catch(err){return (err as NodeJS.ErrnoException).code==='EPERM';}};
// The owner recorded in a lock file: undefined when the file is gone, null when it cannot be read (treated as held).
async function lockOwner(file:string):Promise<{pid:number;token:string}|null|undefined>{
 const raw=await readFile(file,'utf8').catch(err=>(err as NodeJS.ErrnoException).code==='ENOENT'?undefined:'');
 if(raw===undefined)return undefined;
 try{const owner=JSON.parse(raw);return typeof owner?.pid==='number'&&typeof owner?.token==='string'?owner:null;}catch{return null;}
}
export async function withLock<T>(dir:string,fn:()=>Promise<T>):Promise<T>{
 const file=path.resolve(dir,'.lock'),guard=`${file}.reclaim`,mine=held.getStore();
 if(mine?.has(file))return fn();
 // The lock appears with its content already in place (hard link of a finished temp file), so nobody ever reads
 // a half-written lock and mistakes it for a stale one.
 const token=randomBytes(8).toString('hex'),tmp=`${file}.${token}.tmp`;
 await writeFile(tmp,JSON.stringify({pid:process.pid,token,at:new Date().toISOString()}));
 try{
  for(let attempt=0;;attempt++){
   try{await link(tmp,file);break;}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
   if(attempt>=5)throw new LockedError();
   const owner=await lockOwner(file);
   if(owner===undefined)continue; // released in the meantime
   if(!owner)throw new LockedError();
   if(alive(owner.pid))throw new LockedError(owner.pid);
   // A dead owner's lock is removed only under the reclaim guard, created exclusively and held for one read and one
   // delete: two processes reclaiming the same dead lock can never delete the lock one of them has just taken.
   try{await link(tmp,guard);}
   catch(e){
    if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;
    const reclaimer=await lockOwner(guard);
    if(reclaimer&&!alive(reclaimer.pid))throw new LockedError(undefined,'.lock.reclaim');
    await new Promise(r=>setTimeout(r,20));continue; // someone else is reclaiming right now
   }
   try{const current=await lockOwner(file);if(current&&current.pid===owner.pid&&current.token===owner.token)await rm(file,{force:true});}
   finally{await rm(guard,{force:true});}
  }
 }finally{await rm(tmp,{force:true});}
 try{return await held.run(new Set([...(mine??[]),file]),fn);}
 finally{if((await lockOwner(file))?.token===token)await rm(file,{force:true});}
}
// A write that touches both a version and the main project (shared manifest, copy, requests) holds both locks.
export async function withProjectLock<T>(dir:string,fn:()=>Promise<T>):Promise<T>{
 const base=path.resolve(await contentDir(dir));
 return withLock(dir,()=>base===path.resolve(dir)?fn():withLock(base,fn));
}
export class LockedError extends Error{constructor(pid?:number,extra?:string){super(`Projeto em uso por outro processo${pid?` (pid ${pid})`:''}. Aguarda terminar${pid?'':`; se nenhum comando estiver rodando, apaga o arquivo .lock${extra?` e o ${extra}`:''} do projeto`}.`);}}
export const escapeXml=(t:string)=>t.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
