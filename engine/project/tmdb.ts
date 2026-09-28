import path from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { ROOT, contentDir, loadProject, readJson, writeJson, escapeXml, withProjectLock, safeChild } from './io.js';
import { addAsset } from './assets.js';
import { downloadImage } from './requests.js';
// Diego's image process (visual/image-policy.md): stills of films and series the audience knows. TMDB lists the
// backdrops of each title ("Mídia > Imagens de fundo"): the engine downloads small previews into a numbered contact
// sheet, Claude looks at it and picks (close-up, the panel's drama, erotic appeal when it fits, room for the text),
// and only the picked ones are downloaded in full and registered with their origin.
const API=()=>process.env.TMDB_API_BASE||'https://api.themoviedb.org/3';
const IMAGES=()=>process.env.TMDB_IMAGE_BASE||'https://image.tmdb.org/t/p';
const PER_SHEET=12,TILE={w:480,h:270,bar:34};
function token(){
 if(process.env.TMDB_API_KEY===undefined&&existsSync(path.join(ROOT,'.env')))process.loadEnvFile(path.join(ROOT,'.env'));
 const key=process.env.TMDB_API_KEY?.trim();
 if(!key)throw Error('Falta TMDB_API_KEY no .env (chave gratuita em themoviedb.org → Configurações → API; a de leitura v4 ou a v3)');
 return key;
}
async function api(route:string,params:Record<string,string|number|undefined>={}){
 const key=token(),url=new URL(API()+route),bearer=key.startsWith('eyJ');
 for(const [k,v] of Object.entries(params))if(v!==undefined&&v!=='')url.searchParams.set(k,String(v));
 if(!bearer)url.searchParams.set('api_key',key);
 const res=await fetch(url,{headers:{accept:'application/json',...(bearer?{authorization:`Bearer ${key}`}:{})},signal:AbortSignal.timeout(30_000)});
 if(res.status===401)throw Error('TMDB recusou a chave (TMDB_API_KEY inválida)');
 if(!res.ok)throw Error(`TMDB: HTTP ${res.status} em ${route}`);
 return res.json() as Promise<any>;
}
export type TitleType='movie'|'tv';
export type Found={tmdb_id:number;type:TitleType;title:string;original_title:string;year:string;popularity:number};
export async function findTitles(query:string,{type,year}:{type?:TitleType;year?:number}={}):Promise<Found[]>{
 const types:TitleType[]=type?[type]:['movie','tv'],out:Found[]=[];
 for(const t of types){
  const data=await api(`/search/${t}`,{query,language:'pt-BR',include_adult:'false',...(t==='movie'?{primary_release_year:year}:{first_air_date_year:year})});
  for(const r of data.results??[])out.push({tmdb_id:r.id,type:t,title:r.title??r.name,original_title:r.original_title??r.original_name,year:String(r.release_date??r.first_air_date??'').slice(0,4),popularity:r.popularity??0});
 }
 return out.sort((a,b)=>b.popularity-a.popularity);
}
type Still={n:number;file_path:string;width:number;height:number;language:string|null;votes:number;vote_average:number;episode?:string};
export type Search={id:string;query:string;tmdb_id:number;type:TitleType;title:string;year:string;season?:number;slide?:string;created_at:string;stills:Still[];sheets:string[]};
// Backdrops of the title (no-language ones first: they have no title card or logo). With a season, also the stills
// of each episode, which are real scenes.
export async function searchStills(dir:string,query:string,{type,year,season,limit=36,slide}:{type?:TitleType;year?:number;season?:number;limit?:number;slide?:string}={}){
 const base=await contentDir(dir),p=await loadProject(dir);
 if(slide&&!p.art.slides[slide])throw Error('Slide desconhecido');
 if(season!==undefined&&type==='movie')throw Error('--season só vale para séries');
 const found=await findTitles(query,{type:season!==undefined?'tv':type,year});
 if(!found.length)throw Error(`Nada encontrado no TMDB para "${query}"${year?` (${year})`:''}`);
 const t=found[0];
 const images=await api(`/${t.type}/${t.tmdb_id}/images`,{include_image_language:'null,pt,en'});
 const rank=(i:any)=>(i.iso_639_1?1:0)*1000-(i.vote_count??0)*10-(i.vote_average??0);
 let raw:Omit<Still,'n'>[]=(images.backdrops??[]).sort((a:any,b:any)=>rank(a)-rank(b)).map((i:any)=>({file_path:i.file_path,width:i.width,height:i.height,language:i.iso_639_1??null,votes:i.vote_count??0,vote_average:i.vote_average??0}));
 if(season!==undefined){
  const s=await api(`/tv/${t.tmdb_id}/season/${season}`);
  for(const e of s.episodes??[]){
   const shots=await api(`/tv/${t.tmdb_id}/season/${season}/episode/${e.episode_number}/images`);
   for(const i of shots.stills??[])raw.push({file_path:i.file_path,width:i.width,height:i.height,language:i.iso_639_1??null,votes:i.vote_count??0,vote_average:i.vote_average??0,episode:`T${season}E${e.episode_number}`});
  }
  raw=[...raw.filter(r=>r.episode),...raw.filter(r=>!r.episode)];
 }
 const seen=new Set<string>(),stills:Still[]=raw.filter(r=>!seen.has(r.file_path)&&!!seen.add(r.file_path)).slice(0,limit).map((r,i)=>({n:i+1,...r}));
 if(!stills.length)throw Error(`"${t.title}" não tem imagens de fundo no TMDB`);
 const slug=`${t.type}-${t.tmdb_id}${season!==undefined?`-t${season}`:''}`,out=path.join(base,'assets/search',slug);
 await mkdir(out,{recursive:true});
 const previews=await Promise.all(stills.map(async s=>({s,bytes:await downloadImage(`${IMAGES()}/w780${s.file_path}`).catch(()=>null)})));
 const sheets:string[]=[];
 for(let page=0;page*PER_SHEET<previews.length;page++){
  const chunk=previews.slice(page*PER_SHEET,(page+1)*PER_SHEET),cols=4,rows=Math.ceil(chunk.length/cols),gap=8;
  const tiles=await Promise.all(chunk.map(async({s,bytes},k)=>{
   const img=bytes?await sharp(bytes).resize(TILE.w,TILE.h,{fit:'cover'}).toBuffer():await sharp({create:{width:TILE.w,height:TILE.h,channels:3,background:'#400'}}).png().toBuffer();
   const label=`#${s.n}${s.episode?` · ${s.episode}`:''} · ${s.width}×${s.height}${s.language?` · ${s.language} (pode ter texto)`:''}`;
   const bar=Buffer.from(`<svg width="${TILE.w}" height="${TILE.bar}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111"/><text x="10" y="23" font-family="sans-serif" font-size="18" font-weight="700" fill="#fff">${escapeXml(label)}</text></svg>`);
   return {input:await sharp({create:{width:TILE.w,height:TILE.h+TILE.bar,channels:3,background:'#111'}}).composite([{input:img,left:0,top:0},{input:bar,left:0,top:TILE.h}]).png().toBuffer(),left:gap+(k%cols)*(TILE.w+gap),top:gap+Math.floor(k/cols)*(TILE.h+TILE.bar+gap)};
  }));
  const file=path.join(out,`folha-${page+1}.jpg`);
  await sharp({create:{width:gap+cols*(TILE.w+gap),height:gap+rows*(TILE.h+TILE.bar+gap),channels:3,background:'#000'}}).composite(tiles).jpeg({quality:85}).toFile(file);
  sheets.push(file);
 }
 const search:Search={id:slug,query,tmdb_id:t.tmdb_id,type:t.type,title:t.title,year:t.year,season,slide,created_at:new Date().toISOString(),stills,sheets:sheets.map(s=>path.relative(base,s))};
 await writeJson(path.join(out,'index.json'),search);
 return {search:slug,title:`${t.title} (${t.year})`,original_title:t.original_title,type:t.type,stills:stills.length,sheets,other_matches:found.slice(1,4).map(f=>`${f.title} (${f.year}, ${f.type}, id ${f.tmdb_id})`)};
}
// Downloads the picked stills in full and registers them: the first becomes the slide's image (unless --alternative),
// the others its alternatives. Rights stay with the studio: the record says where the still came from.
export async function pickStills(dir:string,searchId:string,numbers:number[],{slide,alternative,focal,rationale}:{slide?:string;alternative?:boolean;focal?:{x:number;y:number};rationale?:string}={}){
 const base=await contentDir(dir),search:Search=await readJson(safeChild(path.join(base,'assets/search'),path.join(searchId,'index.json')));
 slide??=search.slide;
 if(!numbers.length)throw Error('Informe os números da folha (ex.: 3 7 12)');
 const results=[];
 for(const [k,n] of numbers.entries()){
  const s=search.stills.find(x=>x.n===n);if(!s)throw Error(`#${n} não está na busca ${searchId}`);
  const url=`${IMAGES()}/original${s.file_path}`,bytes=await downloadImage(url);
  const name=`${search.title} (${search.year})${s.episode?` ${s.episode}`:''}`;
  const r=await addAsset(dir,bytes,`still de ${name}, imagem de fundo do TMDB; direitos do estúdio, uso editorial`,slide,{origin:'external',provider:'tmdb',source_url:url,credit:name,rationale,params:{tmdb_id:search.tmdb_id,type:search.type,file_path:s.file_path,...(s.episode?{episode:s.episode}:{}),search:searchId,n},alternative:alternative||k>0});
  results.push({n,...r});
 }
 if(focal&&slide&&results.some(r=>r.attached))await withProjectLock(dir,async()=>{const p=await loadProject(dir);p.art.slides[slide!].image.focal_point=focal;await writeJson(path.join(dir,'art-direction.json'),p.art);});
 return {slide:slide??null,title:search.title,registered:results};
}
