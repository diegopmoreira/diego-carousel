import { readFile, writeFile, mkdir, rename, readdir } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Carousel, ArtDirection, Tweaks, Assets } from '../schema/index.js';
export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
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
export async function treeHash(dir:string):Promise<string>{const files=await readdir(dir,{withFileTypes:true}); const rows=await Promise.all(files.sort((a,b)=>a.name.localeCompare(b.name)).map(async f=>[f.name,f.isDirectory()?await treeHash(path.join(dir,f.name)):hash(await readFile(path.join(dir,f.name)))]));return jsonHash(rows);}
export function safeChild(dir:string,relative:string){const p=path.resolve(dir,relative);if(!p.startsWith(path.resolve(dir)+path.sep))throw Error('Caminho fora do projeto');return p;}
