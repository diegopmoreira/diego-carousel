import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, copyFile, access } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path'; import os from 'node:os';
import sharp from 'sharp';
import { ROOT, loadProject } from './io.js';
import { createProject } from './create.js';
import { draft } from './draft.js';
import { searchStills, pickStills } from './tmdb.js';
const dirs:string[]=[];let server:http.Server,calls:string[]=[];
beforeEach(async()=>{
 const d=await mkdtemp(path.join(os.tmpdir(),'tmdb-test-'));dirs.push(d);calls=[];
 process.env.CAROUSEL_PROJECTS_DIR=d;process.env.CAROUSEL_CORPUS_DIR=path.join(ROOT,'fixtures/corpus');process.env.TMDB_API_KEY='v3key';
 const jpg=await sharp({create:{width:320,height:180,channels:3,background:'#a33'}}).jpeg().toBuffer();
 const json=(res:http.ServerResponse,v:unknown)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(v));};
 server=http.createServer((req,res)=>{
  const u=new URL(req.url!,'http://x');calls.push(u.pathname+u.search);
  if(u.pathname==='/3/search/movie')return json(res,{results:[{id:550,title:'Clube da Luta',original_title:'Fight Club',release_date:'1999-10-15',popularity:80}]});
  if(u.pathname==='/3/search/tv')return json(res,{results:[]});
  if(u.pathname==='/3/movie/550/images')return json(res,{backdrops:[{file_path:'/logo.jpg',width:3840,height:2160,iso_639_1:'en',vote_count:9},{file_path:'/a.jpg',width:3840,height:2160,iso_639_1:null,vote_count:5},{file_path:'/b.jpg',width:1920,height:1080,iso_639_1:null,vote_count:2}]});
  if(u.pathname.startsWith('/img/')){res.writeHead(200,{'Content-Type':'image/jpeg'});return res.end(jpg);}
  res.writeHead(404);res.end();
 });
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${(server.address() as any).port}`;
 process.env.TMDB_API_BASE=`${base}/3`;process.env.TMDB_IMAGE_BASE=`${base}/img`;
});
afterEach(async()=>{await new Promise(r=>server.close(r));delete process.env.TMDB_API_BASE;delete process.env.TMDB_IMAGE_BASE;delete process.env.TMDB_API_KEY;await Promise.all(dirs.splice(0).map(d=>rm(d,{recursive:true,force:true})));});
async function full(){const dir=await createProject('stills','corpus:exemplo-publico');await copyFile(path.join(ROOT,'fixtures/full/editorial-report.md'),path.join(dir,'editorial-report.md'));await draft(dir,path.join(ROOT,'fixtures/full/copy.md'),path.join(ROOT,'fixtures/full/editorial.json'));return dir;}
describe('stills do TMDB',()=>{
 it('folha numerada com as imagens de fundo sem idioma primeiro; escolhidas viram imagem + alternativas com origem',async()=>{
  const dir=await full(),cover=(await loadProject(dir)).carousel.slides[0].id;
  const s=await searchStills(dir,'Clube da Luta',{type:'movie',year:1999,slide:cover});
  expect(s.search).toBe('movie-550');expect(s.stills).toBe(3);await access(s.sheets[0]);
  expect(calls.some(c=>c.includes('api_key=v3key'))).toBe(true);
  expect(calls.filter(c=>c.startsWith('/img/w780')).map(c=>c.slice(9))).toEqual(['/a.jpg','/b.jpg','/logo.jpg']);
  const r=await pickStills(dir,'movie-550',[1,2],{focal:{x:.3,y:.4},rationale:'close no rosto'});
  expect(r.registered.map(x=>x.attached)).toEqual([true,false]);
  const p=await loadProject(dir),d=p.art.slides[cover],a=p.assets.assets.find(x=>x.id===d.image.asset_id)!;
  expect(a.provider).toBe('tmdb');expect(a.origin).toBe('external');expect(a.rights).toMatch(/still de Clube da Luta \(1999\)/);expect(a.source_url).toMatch(/\/img\/original\/a\.jpg$/);
  expect(d.image.alternatives).toHaveLength(1);expect(d.image.focal_point).toEqual({x:.3,y:.4});
  await expect(pickStills(dir,'movie-550',[9])).rejects.toThrow(/#9/);
  await expect(pickStills(dir,'../x',[1])).rejects.toThrow();
 });
 it('sem chave explica onde criar',async()=>{
  process.env.TMDB_API_KEY='';const dir=await full();
  await expect(searchStills(dir,'x')).rejects.toThrow(/TMDB_API_KEY/);
 });
});
