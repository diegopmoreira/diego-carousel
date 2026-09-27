import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path'; import os from 'node:os';
import { ROOT, readJson, writeJson, loadProject } from '../project/io.js';
import { importCopy } from '../project/create.js';
import { toTu, proposeVoice, approveVoice, diffPanels } from './voice.js';
import { lint } from './lint.js';
const dirs:string[]=[];
afterEach(async()=>{await Promise.all(dirs.splice(0).map(d=>rm(d,{recursive:true,force:true})));});
async function project(copy:string){
 const dir=await mkdtemp(path.join(os.tmpdir(),'voice-test-'));dirs.push(dir);await mkdir(path.join(dir,'source'));
 const c=await readJson(path.join(ROOT,'engine/schema/examples/carousel.json'));c.slides=[];await writeJson(path.join(dir,'carousel.json'),c);
 await writeJson(path.join(dir,'tweaks.json'),{schema_version:1,slides:{}});await writeJson(path.join(dir,'assets/manifest.json'),{schema_version:1,assets:[]});
 await writeFile(path.join(dir,'in.md'),copy);await importCopy(dir,path.join(dir,'in.md'));return dir;
}
describe('voz: você → tu',()=>{
 it('troca pronomes, preposições e imperativos preservando maiúsculas',()=>{
  expect(toTu('Você não precisa vencer')).toBe('Tu não precisa vencer');
  expect(toTu('Quando alguém discorda de você, fala com você.')).toBe('Quando alguém discorda de ti, fala contigo.');
  expect(toTu('Pare de se esconder. Faça uma pausa.')).toBe('Para de se esconder. Faz uma pausa.');
  expect(toTu('Você se sabota e acredita em si mesmo')).toBe('Tu te sabota e acredita em ti mesmo');
  expect(toTu('Seu medo, **sua** história')).toBe('Teu medo, **tua** história');
  expect(toTu('Isso é pra você')).toBe('Isso é pra ti');
 });
 it('classifica mudanças: pessoa, ambígua e fora da regra',()=>{
  const a=[{headline:'Você e seu medo',body:null}];
  expect(diffPanels(a,[{headline:'Tu e teu medo',body:null}]).map(c=>c.kind)).toEqual(['person','ambiguous']);
  expect(diffPanels([{headline:'Fica com você hoje',body:null}],[{headline:'Fica contigo hoje',body:null}]).map(c=>c.kind)).toEqual(['person']);
  expect(diffPanels([{headline:'Isso é para você',body:null}],[{headline:'Isso é pra ti',body:null}]).map(c=>c.kind)).toEqual(['person']);
  expect(diffPanels(a,[{headline:'Tu e teu susto',body:null}]).some(c=>c.kind==='other')).toBe(true);
 });
 it('proposta não muda nada; aprovação aplica, registra e mantém o lint limpo',async()=>{
  const source=(await readFile(path.join(ROOT,'fixtures/copy-pronta.md'),'utf8')).replace('Tu não precisa vencer toda discussão','Você não precisa vencer toda discussão').replace('Quando alguém discorda de ti','Quando alguém discorda de você');
  const dir=await project(source),before=await readFile(path.join(dir,'carousel.json'),'utf8');
  const r=await proposeVoice(dir);expect(r.changes).toBe(2);expect(r.other).toBe(0);
  expect(await readFile(path.join(dir,'carousel.json'),'utf8')).toBe(before);
  expect(await readFile(path.join(dir,'qa/voice-proposal.md'),'utf8')).toContain('você, → ti,');
  await expect(approveVoice(dir,'')).rejects.toThrow(/--by/);
  await approveVoice(dir,'Diego','ok');
  const p=await loadProject(dir);expect(p.carousel.slides[0].headline).toBe('Tu não precisa vencer toda discussão');
  expect((await readJson(path.join(dir,'approvals.json'))).approvals[0].by).toBe('Diego');
  expect(await readFile(path.join(dir,'source/copy-input.md'),'utf8')).toBe(source);
  const l=await lint(dir);expect(l.passed).toBe(true);expect(l.issues.some(i=>i.message.includes('você'))).toBe(false);
 });
 it('aprovação adulterada ou texto editado fora da cadeia reprovam o lint',async()=>{
  const dir=await project((await readFile(path.join(ROOT,'fixtures/copy-pronta.md'),'utf8')).replace('Tu não precisa','Você não precisa'));
  await proposeVoice(dir);await approveVoice(dir,'Diego');
  const a=await readJson(path.join(dir,'approvals.json'));a.approvals[0].result[0].headline='Outro texto';await writeJson(path.join(dir,'approvals.json'),a);
  expect((await lint(dir)).issues.some(i=>i.path==='approvals.json')).toBe(true);
 });
 it('mudança fora da regra bloqueia a aprovação',async()=>{
  const dir=await project((await readFile(path.join(ROOT,'fixtures/copy-pronta.md'),'utf8')).replace('Tu não precisa','Você não precisa'));
  await proposeVoice(dir);const f=path.join(dir,'qa/voice-proposal.json'),prop=await readJson(f);prop.panels[0].headline='Tu não precisa ganhar toda discussão';await writeJson(f,prop);
  await expect(approveVoice(dir,'Diego')).rejects.toThrow(/não são de pessoa/);
 });
});
describe('edição de copy pronta com aval',()=>{
 it('proposta acumula por slide, não muda nada até approve e entra na cadeia do lint',async()=>{
  const {proposeEdit,approveEdit}=await import('./voice.js');
  const dir=await project(await readFile(path.join(ROOT,'fixtures/copy-pronta.md'),'utf8')),p=await loadProject(dir),id=p.carousel.slides[2].id,before=await readFile(path.join(dir,'carousel.json'),'utf8');
  await expect(proposeEdit(dir,id,{body:'Curto.',reason:''})).rejects.toThrow(/reason/);
  await proposeEdit(dir,id,{body:'Tu prepara a próxima frase enquanto o outro fala.',reason:'não cabe'});
  expect(await readFile(path.join(dir,'carousel.json'),'utf8')).toBe(before);
  expect(await readFile(path.join(dir,'qa/edit-proposal.md'),'utf8')).toContain('não cabe');
  await approveEdit(dir,'Diego');
  expect((await loadProject(dir)).carousel.slides[2].body).toBe('Tu prepara a próxima frase enquanto o outro fala.');
  const l=await lint(dir);expect(l.issues.filter(i=>i.severity==='error')).toEqual([]);
  expect((await readJson(path.join(dir,'approvals.json'))).approvals[0]).toMatchObject({type:'edit',by:'Diego'});
 });
});
