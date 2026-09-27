import { mkdir, readdir, rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { contentDir, loadProject, writeJson, log } from './io.js';
import { Family } from '../schema/index.js';
export function variantName(name:string){if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)||name.length>60)throw Error('Nome da versão: letras minúsculas, números e hífens');return name;}
export async function listVariants(dir:string){const base=await contentDir(dir);try{return (await readdir(path.join(base,'variants'),{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>x.name).sort();}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}}
export async function createVariant(dir:string,name:string,family?:string){
 const base=await contentDir(dir),p=await loadProject(dir),out=path.join(base,'variants',variantName(name));
 if(family)p.art.family=Family.parse(family);
 await mkdir(path.dirname(out),{recursive:true});await mkdir(out);
 await writeJson(path.join(out,'variant.json'),{schema_version:1,name,created_at:new Date().toISOString()});
 await writeJson(path.join(out,'art-direction.json'),p.art);await writeJson(path.join(out,'tweaks.json'),p.tweaks);
 for(const folder of ['html','fit','qa','preview','export'])await mkdir(path.join(out,folder),{recursive:true});
 await log(out,'VARIANT','Versão visual criada. Copy e biblioteca de imagens compartilhadas com o original.');return out;
}
export async function promoteVariant(dir:string,name:string){
 const base=await contentDir(dir),variant=path.join(base,'variants',variantName(name)),p=await loadProject(variant);
 // Keep the previous visual direction recoverable before replacing it.
 const backup=await createVariant(base,'antes-'+Date.now());
 await writeJson(path.join(base,'art-direction.json'),p.art);await writeJson(path.join(base,'tweaks.json'),p.tweaks);
 await log(base,'VARIANT',`Versão ${name} promovida; anterior em ${backup}`);return base;
}
// A throwaway visual variant for experiments (fit-probe, candidates); always removed afterwards.
export async function withTempVariant<T>(dir:string,prefix:string,fn:(variant:string)=>Promise<T>):Promise<T>{
 const base=await contentDir(dir),variant=await createVariant(base,`${prefix}-${randomBytes(3).toString('hex')}`);
 try{return await fn(variant);}finally{await rm(variant,{recursive:true,force:true});}
}
