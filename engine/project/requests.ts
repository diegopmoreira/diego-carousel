import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { AssetRequest, type ArtData } from '../schema/index.js';
import { contentDir, loadProject, opaqueId, writeJson, readJson, log, optionalJson, withProjectLock } from './io.js';
import { loadConfig } from './config.js';
import { addAsset } from './assets.js';
// Image generation goes through a ticket: the engine writes the canonical prompt and checks the budget, Claude
// generates with the provider's MCP (Higgsfield), and `asset add --request` downloads and records the result.
type Composition=ArtData['slides'][string]['composition'];
// Aspect and size per slot. Providers take multiples of 16; the renderer crops with object-fit.
const SLOTS:Record<string,{aspect:string;size:{width:number;height:number};framing:string}>={
 full_bleed:{aspect:'4:5',size:{width:1088,height:1360},framing:'vertical 4:5 frame; main subject in the upper two thirds; the lower third dark and calm, free for text'},
 cinematic_fade:{aspect:'16:10',size:{width:1088,height:672},framing:'wide frame; subject in the upper half; the bottom edge falls into darkness'},
 image_card:{aspect:'2:1',size:{width:1088,height:544},framing:'horizontal 2:1 frame; subject centered; balanced negative space'},
};
const STYLE:Record<ArtData['family'],string>={
 cinematic_condensed:'cinematic film still, 35mm, natural grain, low-key dramatic lighting, deep blacks, muted desaturated colors, shallow depth of field, emotional and introspective',
 editorial_clean:'contemporary editorial photograph, soft natural light, calm composition, restrained palette, clean background, quiet and intelligent mood',
};
export const NEGATIVE='text, letters, words, numbers, captions, subtitles, logo, watermark, signage, typography, UI, frame, border, collage, recognizable real person, celebrity likeness, public figure, deformed hands, extra fingers';
export const RULES=['Sem texto, letras ou logotipos na imagem (o texto é sempre HTML).','Sem semelhança com pessoas reais ou famosas.','Não imitar frames de filmes protegidos; evocar o clima, não copiar a cena.','Conferir visualmente cada imagem antes de registrar.'];
export function canonicalPrompt(family:ArtData['family'],composition:Composition,image:{concept:string;mood:string;subject_priority:string;negative_space:string;crop:string}){
 const slot=SLOTS[composition];if(!slot)throw Error(`A composição ${composition} não tem imagem`);
 const parts=[image.concept.trim()||'(descrever a cena: conceito visual do painel)',image.subject_priority&&`focus on ${image.subject_priority}`,image.mood&&`mood: ${image.mood}`,image.crop&&image.crop!=='cover'&&`${image.crop}`,STYLE[family],slot.framing,image.negative_space&&`keep ${image.negative_space} empty`,'no text anywhere in the image'];
 return parts.filter(Boolean).join('. ')+'.';
}
async function requestsOf(base:string){
 const dir=path.join(base,'assets/requests');
 return Promise.all((await readdir(dir).catch(()=>[])).filter(f=>f.endsWith('.json')).map(async f=>AssetRequest.parse(await readJson(path.join(dir,f)))));
}
export function requestAsset(dir:string,slide:string,{variants,concept,provider,model}:{variants?:number;concept?:string;provider?:string;model?:string}={}){return withProjectLock(dir,async()=>{
 const base=await contentDir(dir),p=await loadProject(dir),config=await loadConfig(),d=p.art.slides[slide];
 if(!d)throw Error('Slide desconhecido');
 const composition=(p.tweaks.slides[slide]?.composition??d.composition) as Composition;
 const index=p.carousel.slides.findIndex(s=>s.id===slide),count=variants??(index===0?config.assets.cover_variants:config.assets.body_variants);
 // Budget: every requested variant counts, generated or not, until the ticket is cancelled.
 const used=(await requestsOf(base)).filter(r=>r.status!=='cancelled').reduce((n,r)=>n+r.variants,0),limit=config.assets.max_generations_per_carousel;
 if(used+count>limit)throw Error(`Teto de gerações do carrossel: ${used} de ${limit} já pedidas; este pedido soma ${count}. Cancelar pedidos antigos (asset cancel) ou subir o teto em config.json com aval de Diego.`);
 const image={...d.image,concept:concept??d.image.concept};
 const request=AssetRequest.parse({schema_version:1,id:opaqueId(),slide,status:'open',created_at:new Date().toISOString(),provider:provider??String(config.providers.default??'higgsfield'),model,
  family:p.art.family,composition,aspect:SLOTS[composition]?.aspect,size:SLOTS[composition]?.size,variants:count,prompt:canonicalPrompt(p.art.family,composition,image),negative:NEGATIVE,concept:image.concept,rules:RULES,results:[]});
 await writeJson(path.join(base,`assets/requests/${request.id}.json`),request);
 await log(base,'ASSET',`Pedido ${request.id} para ${slide}: ${count} variante(s), ${used+count}/${limit} do teto`);
 return {...request,budget:{used:used+count,limit}};
});}
export function cancelRequest(dir:string,id:string){return withProjectLock(dir,async()=>{
 const base=await contentDir(dir),file=path.join(base,`assets/requests/${id}.json`),r=await optionalJson(file);
 if(!r)throw Error('Pedido desconhecido');const req=AssetRequest.parse(r);if(req.results.length)throw Error('Pedido já tem imagens registradas');
 req.status='cancelled';await writeJson(file,req);return req;
});}
// Generated URLs expire: download right away, with limits, and keep the full request with the image.
export async function downloadImage(url:string){
 const u=new URL(url),local=u.hostname==='127.0.0.1'||u.hostname==='localhost';
 if(u.protocol!=='https:'&&!(u.protocol==='http:'&&local))throw Error('Só URLs https');
 const res=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(60_000)});
 if(!res.ok)throw Error(`Download falhou: HTTP ${res.status}`);
 const type=res.headers.get('content-type')??'';if(type&&!/^image\/(png|jpeg|webp)/.test(type))throw Error(`Tipo inesperado: ${type}`);
 const bytes=Buffer.from(await res.arrayBuffer());if(bytes.length>20*1024*1024)throw Error('Imagem maior que 20 MB');
 return bytes;
}
export async function addFromRequest(dir:string,id:string,source:{url?:string;bytes?:Buffer},extra:{seed?:string|number;model?:string;params?:Record<string,unknown>;score?:number;rationale?:string}={}){
 // Download first (outside the lock: it may take a while), then register under the project lock.
 const bytes=source.bytes??(source.url?await downloadImage(source.url):undefined);
 return withProjectLock(dir,()=>registerFromRequest(dir,id,{url:source.url,bytes},extra));
}
async function registerFromRequest(dir:string,id:string,source:{url?:string;bytes?:Buffer},extra:{seed?:string|number;model?:string;params?:Record<string,unknown>;score?:number;rationale?:string}){
 const base=await contentDir(dir),file=path.join(base,`assets/requests/${id}.json`),raw=await optionalJson(file);
 if(!raw)throw Error('Pedido desconhecido');const request=AssetRequest.parse(raw);
 if(request.status==='cancelled')throw Error('Pedido cancelado');
 if(request.results.length>=request.variants)throw Error(`O pedido já tem ${request.variants} imagem(ns); faça outro pedido`);
 const bytes=source.bytes;if(!bytes)throw Error('Informe --url ou um arquivo');
 const first=request.results.length===0;
 const added=await addAsset(dir,bytes,`Gerada via ${request.provider}${extra.model??request.model?` (${extra.model??request.model})`:''} para este carrossel; sem pessoas reais, sem texto`,request.slide,{
  origin:'generated',provider:request.provider,model:extra.model??request.model,prompt:request.prompt,negative:request.negative,request:request,request_id:request.id,
  seed:extra.seed,params:extra.params,score:extra.score,rationale:extra.rationale,source_url:source.url,alternative:!first});
 request.results.push(added.id);if(request.results.length>=request.variants)request.status='done';
 await writeJson(file,request);
 await log(base,'ASSET',`Pedido ${id}: imagem ${added.id} (${request.results.length}/${request.variants})`);
 return {...added,request:id,remaining:request.variants-request.results.length};
}
