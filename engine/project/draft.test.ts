import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mkdtemp, rm, copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path'; import os from 'node:os';
import { ROOT, loadProject, readJson } from './io.js';
import { createProject } from './create.js';
import { draft, slideAdd, slideMove, slideRemove } from './draft.js';
import { lint, visualLint } from '../qa/lint.js';
const dirs:string[]=[],F=(f:string)=>path.join(ROOT,'fixtures/full',f);
beforeEach(async()=>{const d=await mkdtemp(path.join(os.tmpdir(),'draft-test-'));dirs.push(d);process.env.CAROUSEL_PROJECTS_DIR=d;process.env.CAROUSEL_CORPUS_DIR=path.join(ROOT,'fixtures/corpus');});
afterEach(async()=>{await Promise.all(dirs.splice(0).map(d=>rm(d,{recursive:true,force:true})));});
async function full(){const dir=await createProject('fluxo-full','corpus:exemplo-publico');await copyFile(F('editorial-report.md'),path.join(dir,'editorial-report.md'));await draft(dir,F('copy.md'),F('editorial.json'));return dir;}
describe('draft e edição estrutural',()=>{
 it('cria slides com IDs opacos, metadados e direção de arte por função; lint e lint visual limpos',async()=>{
  const dir=await full(),p=await loadProject(dir);
  expect(p.carousel.slides).toHaveLength(10);expect(p.carousel.slides.every(s=>/^k[a-f0-9]{10}$/.test(s.id))).toBe(true);
  expect(p.carousel.slides[3]).toMatchObject({narrative_role:'mechanism',headline_type:'reframe',next_question:'Por que continuo buscando atenção?'});
  expect(p.art.family).toBe('cinematic_condensed');expect(p.art.slides[p.carousel.slides[0].id].composition).toBe('full_bleed');
  expect(p.art.slides[p.carousel.slides[0].id].image).toMatchObject({need:true,placeholder:true});
  const l=await lint(dir);expect(l.issues.filter(i=>i.severity==='error')).toEqual([]);expect(await visualLint(dir)).toEqual([]);
 });
 it('redraft preserva IDs e ajustes; slides novos ganham IDs novos',async()=>{
  const dir=await full(),before=await loadProject(dir),ids=before.carousel.slides.map(s=>s.id);
  const a=await readJson(path.join(dir,'art-direction.json'));a.slides[ids[4]].composition='quote';await writeFile(path.join(dir,'art-direction.json'),JSON.stringify(a));
  const edited=(await readFile(F('copy.md'),'utf8')).replace('Atenção barata não é amor','Atenção barata ainda não é amor');await writeFile(path.join(dir,'v2.md'),edited);
  const r=await draft(dir,path.join(dir,'v2.md'),F('editorial.json'));expect(r.kept).toBe(10);
  const after=await loadProject(dir);expect(after.carousel.slides.map(s=>s.id)).toEqual(ids);expect(after.carousel.slides[3].headline).toBe('Atenção barata ainda não é amor');expect(after.art.slides[ids[4]].composition).toBe('quote');
 });
 it('slide add, move e rm mantêm direção de arte consistente',async()=>{
  const dir=await full(),ids=(await loadProject(dir)).carousel.slides.map(s=>s.id);
  const added=await slideAdd(dir,{headline:'Nem toda falta pede resposta imediata',body:'Corpo sintético.',after:ids[2]});expect(added.position).toBe(4);
  await slideMove(dir,added.id,9);let p=await loadProject(dir);expect(p.carousel.slides[8].id).toBe(added.id);expect(p.art.slides[added.id]).toBeDefined();
  await slideRemove(dir,ids[5]);p=await loadProject(dir);expect(p.carousel.slides.some(s=>s.id===ids[5])).toBe(false);expect(p.art.slides[ids[5]]).toBeUndefined();
  expect(await readFile(path.join(dir,'copy.md'),'utf8')).toContain('Nem toda falta pede resposta imediata');
 });
 it('copy travada recusa draft e edição estrutural',async()=>{
  const dir=await createProject('pronta','copy');const {importCopy}=await import('./create.js');await importCopy(dir,path.join(ROOT,'fixtures/copy-pronta.md'));
  await expect(draft(dir,F('copy.md'))).rejects.toThrow(/travada/);
  await expect(slideRm(dir)).rejects.toThrow(/travada/);
 });
});
async function slideRm(dir:string){const p=await loadProject(dir);return slideRemove(dir,p.carousel.slides[1].id);}
describe('backlog de teses',()=>{
 it('grava uma linha JSON por tese e recusa duplicata',async()=>{
  const d=await mkdtemp(path.join(os.tmpdir(),'backlog-'));dirs.push(d);process.env.CAROUSEL_BACKLOG=path.join(d,'b.jsonl');
  const {addIdea,listIdeas}=await import('./backlog.js');
  await addIdea({thesis:'Nem toda falta pede resposta imediata',source:'corpus:exemplo-publico',why:'Boa segunda leitura do mesmo vídeo'});
  await expect(addIdea({thesis:'Nem toda falta pede resposta imediata',source:'corpus:x',why:'duplicada'})).rejects.toThrow(/já está/);
  await expect(addIdea({thesis:'curta',source:'x',why:'y'})).rejects.toThrow();
  expect((await listIdeas())).toHaveLength(1);
 });
});
