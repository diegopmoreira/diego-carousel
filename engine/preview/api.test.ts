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
