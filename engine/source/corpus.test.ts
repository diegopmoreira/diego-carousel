import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import path from 'node:path'; import os from 'node:os';
import { ROOT, readJson } from '../project/io.js';
import { createProject } from '../project/create.js';
import { parseCorpus, checkCorpusSource } from './corpus.js';
const dirs:string[]=[];
beforeAll(()=>{process.env.CAROUSEL_CORPUS_DIR=path.join(ROOT,'fixtures/corpus');});
afterEach(async()=>{await Promise.all(dirs.splice(0).map(d=>rm(d,{recursive:true,force:true})));});
async function projects(){const d=await mkdtemp(path.join(os.tmpdir(),'corpus-test-'));dirs.push(d);process.env.CAROUSEL_PROJECTS_DIR=d;return d;}
describe('fonte do Corpus',()=>{
 it('corpus:<id> cria projeto full com transcrição marcada por tempo e falante',async()=>{
  await projects();const dir=await createProject('teste-corpus','corpus:exemplo-publico');
  const c=await readJson(path.join(dir,'carousel.json'));
  expect(c.project.mode).toBe('full');expect(c.source).toMatchObject({type:'corpus_video',ref:'corpus:exemplo-publico',title:'Exemplo sintético de vídeo público'});
  const t=await readFile(path.join(dir,'source/transcript.txt'),'utf8');expect(t).toContain('[1:05] (Diego) O erro é beber água salgada.');
 });
 it('recusa supervisão e conversa; conversa pode ser liberada explicitamente',async()=>{
  await projects();
  await expect(createProject('sup','corpus:exemplo-supervisao')).rejects.toThrow(/supervisão/);
  await expect(createProject('conv','corpus:exemplo-conversa')).rejects.toThrow(/conversa/);
  const dir=await createProject('conv','corpus:exemplo-conversa',{allowConversation:true});
  expect(await readFile(path.join(dir,'source/transcript.txt'),'utf8')).toMatch(/^# Conversa: citar somente as falas de Diego/);
 });
 it('aceita o v1.json salvo em arquivo e rejeita IDs estranhos',async()=>{
  await projects();const dir=await createProject('arquivo',path.join(ROOT,'fixtures/corpus/transcricoes/exemplo-publico/v1.json'));
  expect((await readJson(path.join(dir,'carousel.json'))).source.ref).toBe('corpus:exemplo-publico');
  await expect(createProject('x','corpus:../../etc')).rejects.toThrow(/inválido/);
 });
 it('lê campos em inglês e timestamps em texto',()=>{
  const t=parseCorpus(JSON.stringify({text:'a b',segments:[{start:'01:02',text:'a',speaker:'Diego Moreira'}]}),'id1');
  expect(t.segments[0].start).toBe(62);expect(checkCorpusSource(t).conversation).toBe(false);
 });
});
