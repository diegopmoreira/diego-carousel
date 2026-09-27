import { it,expect,afterEach } from 'vitest';
import { mkdtemp,mkdir,readFile,rm } from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import { ROOT,writeJson,readJson,loadProject } from '../project/io.js';
import { importCopy } from '../project/create.js';
import { createVariant,promoteVariant } from '../project/variants.js';
import { adjust,revision } from './api.js';
const dirs:string[]=[];
async function fixture(){const dir=await mkdtemp(path.join(os.tmpdir(),'studio-test-'));dirs.push(dir);await mkdir(path.join(dir,'source'));const c=await readJson(path.join(ROOT,'engine/schema/examples/carousel.json'));c.slides=[];await writeJson(path.join(dir,'carousel.json'),c);await writeJson(path.join(dir,'assets/manifest.json'),{schema_version:1,assets:[]});await writeJson(path.join(dir,'tweaks.json'),{schema_version:1,slides:{}});await importCopy(dir,path.join(ROOT,'fixtures/copy-pronta.md'));return dir;}
afterEach(async()=>{await Promise.all(dirs.splice(0).map(d=>rm(d,{recursive:true,force:true})));});
it('recusa ajustes antigos e fora dos limites sem alterar arquivos',async()=>{const dir=await fixture(),p=await loadProject(dir),id=p.carousel.slides[0].id,before=await revision(dir);await expect(adjust(dir,{revision:'antiga',id,family:'cinematic_condensed'})).rejects.toThrow('mudou');await expect(adjust(dir,{revision:before,id,params:{headline_size_delta:100}})).rejects.toThrow();expect(await revision(dir)).toBe(before);});
it('versões compartilham copy e assets, preservam direção principal e mantêm backup ao promover',async()=>{const dir=await fixture(),original=await loadProject(dir),v=await createVariant(dir,'teste','cinematic_condensed');expect((await loadProject(v)).carousel).toEqual(original.carousel);expect((await loadProject(dir)).art).toEqual(original.art);await expect(readFile(path.join(v,'carousel.json'))).rejects.toThrow();await promoteVariant(dir,'teste');expect((await loadProject(dir)).art.family).toBe('cinematic_condensed');expect((await loadProject(dir)).carousel).toEqual(original.carousel);});
it('recusa traversal e colisão de nome de versão',async()=>{const dir=await fixture();await expect(createVariant(dir,'../fora')).rejects.toThrow();await createVariant(dir,'nova');await expect(createVariant(dir,'nova')).rejects.toThrow();});
it('um ajuste visual não muda a copy',async()=>{const dir=await fixture(),p=await loadProject(dir),before=await readFile(path.join(dir,'carousel.json'),'utf8');await adjust(dir,{revision:await revision(dir),id:p.carousel.slides[2].id,params:{headline_size_delta:6},align:'center'});expect(await readFile(path.join(dir,'carousel.json'),'utf8')).toBe(before);expect((await loadProject(dir)).tweaks.slides[p.carousel.slides[2].id].params.headline_size_delta).toBe(6);});
it('salvar um ajuste preserva a exigência de imagem e só grava o que mudou',async()=>{
 const dir=await fixture(),p=await loadProject(dir),id=p.carousel.slides[2].id;
 const a=await readJson(path.join(dir,'art-direction.json'));a.slides[id].composition='image_card';a.slides[id].image.need=true;a.slides[id].image.placeholder=true;await writeJson(path.join(dir,'art-direction.json'),a);
 const artBefore=await readFile(path.join(dir,'art-direction.json'),'utf8');
 await adjust(dir,{revision:await revision(dir),id,params:{headline_size_delta:4}});
 expect(await readFile(path.join(dir,'art-direction.json'),'utf8')).toBe(artBefore);
 await adjust(dir,{revision:await revision(dir),id,composition:'cinematic_fade'});
 let now=await loadProject(dir);expect(now.art.slides[id].composition).toBe('image_card');expect(now.tweaks.slides[id].composition).toBe('cinematic_fade');expect(now.tweaks.slides[id].params.headline_size_delta).toBe(4);
 await adjust(dir,{revision:await revision(dir),id,asset_id:null});
 now=await loadProject(dir);expect(now.art.slides[id].image.need).toBe(true);expect(now.art.slides[id].image.placeholder).toBe(true);expect(now.art.slides[id].image.asset_id).toBeUndefined();
});
it('composição de texto com imagem exigida é recusada; junto com "sem imagem" passa',async()=>{
 const dir=await fixture(),p=await loadProject(dir),id=p.carousel.slides[2].id;
 const a=await readJson(path.join(dir,'art-direction.json'));a.slides[id].composition='image_card';a.slides[id].image.need=true;a.slides[id].image.placeholder=true;await writeJson(path.join(dir,'art-direction.json'),a);
 await expect(adjust(dir,{revision:await revision(dir),id,composition:'quote'})).rejects.toThrow('não mostra imagem');
 await adjust(dir,{revision:await revision(dir),id,composition:'quote',image_need:false});
 const now=await loadProject(dir);expect(now.tweaks.slides[id].composition).toBe('quote');expect(now.art.slides[id].image).toMatchObject({need:false,placeholder:false,strategy:'none'});
 // image --need on a text layout is refused too (the CLI goes through the same adjust).
 await expect(adjust(dir,{revision:await revision(dir),id,image_need:true})).rejects.toThrow('não mostra imagem');
});
it('lock: segundo processo é recusado, lock morto é recuperado, aninhado passa',async()=>{
 const {withLock,LockedError}=await import('../project/io.js');const {writeFile:w}=await import('node:fs/promises');
 const dir=await fixture();
 await withLock(dir,async()=>{await withLock(dir,async()=>{});});
 await w(path.join(dir,'.lock'),JSON.stringify({pid:999999,token:'x'}));
 expect(await withLock(dir,async()=>'ok')).toBe('ok');
 await w(path.join(dir,'.lock'),JSON.stringify({pid:process.ppid,token:'y'}));
 await expect(withLock(dir,async()=>'x')).rejects.toBeInstanceOf(LockedError);
 await w(path.join(dir,'.lock'),'');
 await expect(withLock(dir,async()=>'x')).rejects.toBeInstanceOf(LockedError);
});
it('lock: dois processos disputando um lock abandonado, só um entra',async()=>{
 const {withLock,LockedError}=await import('../project/io.js');const {writeFile:w}=await import('node:fs/promises');
 const dir=await fixture();
 for(let round=0;round<40;round++){
  await w(path.join(dir,'.lock'),JSON.stringify({pid:999999,token:'morto'}));
  let inside=0,max=0;const job=()=>withLock(dir,async()=>{inside++;max=Math.max(max,inside);await new Promise(r=>setTimeout(r,20));inside--;});
  const results=await Promise.allSettled([job(),job(),job()]);
  expect(max).toBe(1);expect(results.filter(r=>r.status==='fulfilled').length).toBeGreaterThanOrEqual(1);
  for(const r of results)if(r.status==='rejected')expect(r.reason).toBeInstanceOf(LockedError);
 }
 // A reclaimer that died holding the guard is never guessed around: the message says which files to delete.
 await w(path.join(dir,'.lock'),JSON.stringify({pid:999999,token:'morto'}));await w(path.join(dir,'.lock.reclaim'),JSON.stringify({pid:999999,token:'guarda'}));
 await expect(withLock(dir,async()=>'x')).rejects.toThrow('.lock.reclaim');
});
