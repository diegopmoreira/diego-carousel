import {it,expect,afterEach} from 'vitest';
import {mkdtemp,writeFile,rm,mkdir,readFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {importCopy} from '../project/create.js';import {hash,writeJson,readJson,ROOT} from '../project/io.js';import {lint,visualLint} from './lint.js';
const dirs:string[]=[];
async function fixture(){const dir=await mkdtemp(path.join(os.tmpdir(),'carousel-test-'));dirs.push(dir);await mkdir(path.join(dir,'source'));await mkdir(path.join(dir,'qa'));await writeJson(path.join(dir,'carousel.json'),{schema_version:1,project:{id:'k123',created_at:new Date().toISOString(),engine_version:'0.1.0',skill_version:'0.1.0',language:'pt-BR',canvas:{width:1080,height:1350},mode:'design-only',copy_locked:true},source:{type:'copy_input',ref:'copy',title:'Teste',hash:hash('')},editorial:{cta:{type:'none',text:''}},slides:[]});await writeJson(path.join(dir,'tweaks.json'),{schema_version:1,slides:{}});await writeJson(path.join(dir,'assets/manifest.json'),{schema_version:1,assets:[]});await importCopy(dir,path.join(ROOT,'fixtures/copy-pronta.md'));return dir;}
afterEach(async()=>{await Promise.all(dirs.splice(0).map(d=>rm(d,{recursive:true,force:true})));});
it('importação gera um projeto válido e copy travada',async()=>{const dir=await fixture();expect((await lint(dir)).passed).toBe(true);expect(await visualLint(dir)).toEqual([]);});
it('detecta alteração da copy e alteração da fonte',async()=>{const dir=await fixture();const c=await readJson(path.join(dir,'carousel.json'));c.slides[1].headline='Você consegue fazer isso';await writeJson(path.join(dir,'carousel.json'),c);const r=await lint(dir);expect(r.passed).toBe(false);expect(r.issues.some(i=>i.severity==='error'&&i.message.includes('Copy travada'))).toBe(true);await writeFile(path.join(dir,'source/copy-input.md'),'Alteração');expect((await lint(dir)).issues.some(i=>i.path==='source.hash')).toBe(true);});
it('rejeita órfãos e falta de assets',async()=>{const dir=await fixture(),a=await readJson(path.join(dir,'art-direction.json'));a.slides.korph=a.slides[Object.keys(a.slides)[0]];a.slides.korph.image.need=true;await writeJson(path.join(dir,'art-direction.json'),a);expect((await visualLint(dir)).some(e=>e.includes('órfã'))).toBe(true);});
it('não reimporta sobre copy existente',async()=>{const dir=await fixture();await expect(importCopy(dir,path.join(ROOT,'fixtures/copy-pronta.md'))).rejects.toThrow('Importação inicial');});
it('copy pronta com você passa com aviso; no modo full é erro',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'carousel-test-'));dirs.push(dir);await mkdir(path.join(dir,'source'));
 const c=await readJson(path.join(ROOT,'engine/schema/examples/carousel.json'));c.slides=[];await writeJson(path.join(dir,'carousel.json'),c);await writeJson(path.join(dir,'tweaks.json'),{schema_version:1,slides:{}});await writeJson(path.join(dir,'assets/manifest.json'),{schema_version:1,assets:[]});
 const source=(await readFile(path.join(ROOT,'fixtures/copy-pronta.md'),'utf8')).replace('Tu não precisa vencer toda discussão','Você não precisa vencer toda discussão');
 await writeFile(path.join(dir,'voce.md'),source);await importCopy(dir,path.join(dir,'voce.md'));
 const r=await lint(dir);expect(r.passed).toBe(true);expect(r.issues.some(i=>i.severity==='warning'&&i.message.includes('você'))).toBe(true);
 const full=await readJson(path.join(dir,'carousel.json'));full.project.mode='full';full.project.copy_locked=false;full.source.type='transcript_file';await writeJson(path.join(dir,'carousel.json'),full);
 expect((await lint(dir)).issues.some(i=>i.severity==='error'&&i.message.includes('tu'))).toBe(true);
});
