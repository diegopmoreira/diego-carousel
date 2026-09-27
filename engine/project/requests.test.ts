import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, copyFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path'; import os from 'node:os';
import sharp from 'sharp';
import { ROOT, loadProject, readJson } from './io.js';
import { createProject } from './create.js';
import { draft } from './draft.js';
import { requestAsset, addFromRequest, cancelRequest, canonicalPrompt } from './requests.js';
import { chooseAsset } from './assets.js';
const dirs:string[]=[];let server:http.Server,url='';
beforeEach(async()=>{
 const d=await mkdtemp(path.join(os.tmpdir(),'req-test-'));dirs.push(d);process.env.CAROUSEL_PROJECTS_DIR=d;process.env.CAROUSEL_CORPUS_DIR=path.join(ROOT,'fixtures/corpus');
 const png=await sharp({create:{width:64,height:80,channels:3,background:'#335'}}).png().toBuffer();
 server=http.createServer((req,res)=>{if(req.url==='/img.png'){res.writeHead(200,{'Content-Type':'image/png'});res.end(png);}else if(req.url==='/page'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<html>');}else{res.writeHead(404);res.end();}});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${(server.address() as any).port}`;
});
afterEach(async()=>{await new Promise(r=>server.close(r));await Promise.all(dirs.splice(0).map(d=>rm(d,{recursive:true,force:true})));});
async function full(){const dir=await createProject('imagens','corpus:exemplo-publico');await copyFile(path.join(ROOT,'fixtures/full/editorial-report.md'),path.join(dir,'editorial-report.md'));await draft(dir,path.join(ROOT,'fixtures/full/copy.md'),path.join(ROOT,'fixtures/full/editorial.json'));return dir;}
describe('pedidos de imagem',()=>{
 it('prompt canônico por família e composição, sempre sem texto',()=>{
  const p=canonicalPrompt('cinematic_condensed','full_bleed',{concept:'a glass of salt water on a table',mood:'lonely',subject_priority:'the glass',negative_space:'lower third',crop:'cover'});
  expect(p).toMatch(/film still/);expect(p).toMatch(/lower third/);expect(p).toMatch(/no text/);
  expect(()=>canonicalPrompt('editorial_clean','text_only',{concept:'x',mood:'',subject_priority:'',negative_space:'',crop:'cover'})).toThrow();
 });
 it('capa pede 3 variantes; a primeira vira a imagem, as outras alternativas; o manifesto guarda o pedido',async()=>{
  const dir=await full(),cover=(await loadProject(dir)).carousel.slides[0].id;
  const r=await requestAsset(dir,cover,{concept:'a glass of salt water on a dark table'});
  expect(r.variants).toBe(3);expect(r.size).toEqual({width:1088,height:1360});expect(r.negative).toMatch(/watermark/);
  const a=await addFromRequest(dir,r.id,{url:`${url}/img.png`},{seed:42,score:8,rationale:'boa leitura'});expect(a.attached).toBe(true);
  const b=await addFromRequest(dir,r.id,{url:`${url}/img.png`});expect(b.attached).toBe(false);
  let p=await loadProject(dir);expect(p.art.slides[cover].image.asset_id).toBe(a.id);expect(p.art.slides[cover].image.alternatives).toContain(b.id);
  const m=p.assets.assets.find(x=>x.id===a.id)!;expect(m).toMatchObject({origin:'generated',request_id:r.id,seed:42,score:8,source_url:`${url}/img.png`});expect(m.prompt).toBe(r.prompt);expect(m.sha256).toMatch(/^[a-f0-9]{64}$/);
  await chooseAsset(dir,cover,b.id,{score:9});p=await loadProject(dir);expect(p.art.slides[cover].image.asset_id).toBe(b.id);expect(p.art.slides[cover].image.alternatives).toContain(a.id);
  await addFromRequest(dir,r.id,{url:`${url}/img.png`});
  await expect(addFromRequest(dir,r.id,{url:`${url}/img.png`})).rejects.toThrow(/já tem 3/);
  expect((await readJson(path.join(dir,`assets/requests/${r.id}.json`))).status).toBe('done');
 });
 it('recusa download que não é imagem e respeita o teto de gerações',async()=>{
  const dir=await full(),project=await loadProject(dir),slides=project.carousel.slides;
  const r=await requestAsset(dir,slides[0].id);
  await expect(addFromRequest(dir,r.id,{url:`${url}/page`})).rejects.toThrow(/Tipo inesperado/);
  await expect(addFromRequest(dir,r.id,{url:'ftp://example.com/x.png'})).rejects.toThrow(/https/);
  const fade=slides.find((s,i)=>i>0&&project.art.slides[s.id].composition==='cinematic_fade')!;
  await expect(requestAsset(dir,slides.find(s=>project.art.slides[s.id].composition==='text_only')!.id)).rejects.toThrow(/não tem imagem/);
  for(let i=0;i<3;i++)await requestAsset(dir,fade.id,{variants:3});
  await expect(requestAsset(dir,fade.id,{variants:1})).rejects.toThrow(/Teto/);
  await cancelRequest(dir,r.id);await requestAsset(dir,fade.id,{variants:3});
 });
});
