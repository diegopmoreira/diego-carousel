import os from 'node:os';
import path from 'node:path';
import { readFile, access } from 'node:fs/promises';
import { optionalJson } from '../project/io.js';
import { normalizeSource } from './copy.js';
// Corpus Diego transcripts: <corpus>/transcricoes/<video_id>/v1.json, as exported by CorpusDiego (Whisper):
// {video_id, modelo, texto, segmentos:[{inicio_s, fim_s, …stats}], palavras:[{word, start, end, probability}]}.
// Segments carry timings only; their text is rebuilt from the timed words. Title, type and visibility live in
// <corpus>/corpus.db (table `video`), read-only; `catalogo.json` in the same folder is the fallback (fixtures).
export type CorpusSegment={start:number|null;end:number|null;speaker:string|null;text:string};
export type CorpusTranscript={id:string|null;title:string|null;text:string;segments:CorpusSegment[];metadata:Record<string,unknown>};
export type CorpusCatalogEntry={titulo?:string;tipo?:string;visibilidade?:string;excluir?:number|boolean;live_status?:string;falantes?:string[]};
export function corpusDir(){
 return path.resolve(process.env.CAROUSEL_CORPUS_DIR||path.join(os.homedir(),'Library/Application Support/CorpusDiego/data'));
}
export const corpusFile=(id:string)=>{
 if(!/^[A-Za-z0-9_-]{3,64}$/.test(id))throw Error(`ID de vídeo inválido: ${id}`);
 return path.join(corpusDir(),'transcricoes',id,'v1.json');
};
const pick=(o:any,...keys:string[])=>{for(const k of keys)if(o?.[k]!==undefined&&o[k]!==null)return o[k];return undefined;};
const seconds=(v:unknown)=>typeof v==='number'?v:typeof v==='string'&&/^\d+(?:\.\d+)?$/.test(v)?Number(v):typeof v==='string'&&/^\d{1,2}(?::\d{2}){1,2}$/.test(v)?v.split(':').reduce((a,p)=>a*60+Number(p),0):null;
type Word={start:number|null;text:string};
const joinWords=(words:Word[])=>words.map((w,i)=>i&&!/^\s/.test(w.text)?' '+w.text:w.text).join('').replace(/\s+/g,' ').trim();
export function parseCorpus(raw:string,fallbackId:string|null=null,extra:Record<string,unknown>={}):CorpusTranscript{
 let data:any;try{data=JSON.parse(raw);}catch{throw Error('Transcrição do Corpus não é JSON válido');}
 const words:Word[]=(pick(data,'palavras','words')??[]).map((w:any)=>({start:seconds(pick(w,'start','inicio','início','inicio_s')),text:String(pick(w,'word','palavra','text','texto')??'')})).filter((w:Word)=>w.text.trim());
 const segments:CorpusSegment[]=[];
 for(const s of pick(data,'segmentos','segments')??[]){
  const start=seconds(pick(s,'inicio_s','inicio','início','start')),end=seconds(pick(s,'fim_s','fim','end'));
  let text=pick(s,'texto','text');
  // Real export: timings only. Rebuild the segment from the words that start inside it.
  if(typeof text!=='string'&&start!==null&&end!==null)text=joinWords(words.filter(w=>w.start!==null&&w.start>=start&&w.start<end));
  if(typeof text!=='string'||!text.trim())continue;
  const speaker=pick(s,'falante','speaker','locutor');
  segments.push({start,end,speaker:typeof speaker==='string'&&speaker.trim()?speaker.trim():null,text:normalizeSource(text).trim()});
 }
 let text=pick(data,'texto','text');
 if(typeof text!=='string'){if(segments.length)text=segments.map(s=>s.text).join(' ');else if(words.length)text=joinWords(words);else throw Error('Transcrição sem `texto`, `segmentos` ou `palavras`');}
 const {texto:_t,text:_x,segmentos:_s,segments:_g,palavras:_p,words:_w,...rest}=data;
 const metadata={...rest,...extra};
 const title=pick(metadata,'titulo','título','title');
 return {id:String(pick(metadata,'video_id','id')??fallbackId??'')||null,title:typeof title==='string'?title:null,text:normalizeSource(text).trim(),segments,metadata};
}
// Catalog entry for a video: corpus.db (read-only) first, then catalogo.json. null when the Corpus has no record.
export async function corpusCatalog(id:string):Promise<CorpusCatalogEntry|null>{
 const db=path.join(corpusDir(),'corpus.db');
 if(await access(db).then(()=>true,()=>false)){
  const {DatabaseSync}=await import('node:sqlite');
  const d=new DatabaseSync(db,{readOnly:true});
  try{
   const v:any=d.prepare('select titulo,tipo,visibilidade,excluir,live_status from video where id=?').get(id);
   if(!v)return null;
   const falantes=(d.prepare('select distinct s.falante as f from segment s join transcript t on t.id=s.transcript_id where t.video_id=?').all(id) as any[]).map(r=>String(r.f)).filter(Boolean);
   return {titulo:v.titulo,tipo:v.tipo,visibilidade:v.visibilidade,excluir:Number(v.excluir),live_status:v.live_status??undefined,falantes};
  }finally{d.close();}
 }
 const catalog=await optionalJson(path.join(corpusDir(),'catalogo.json'));
 return catalog?.[id]??null;
}
// Supervisions, clinical sessions and conversations stay out: they carry third parties' cases and words.
const PRIVATE=/supervis|sess[aã]o cl[ií]nica|caso cl[ií]nico|atendimento/i;
const CONVERSATION=/conversa|entrevista|podcast|bate-?papo|live com|debate|\bfeat\b|\bft\.|convidad|participa[cç][aã]o/i;
const DIEGO=/diego/i;
// Speaker labels from the Corpus pipeline: `outro`/`misto` mean someone other than Diego talks; `incerto` is unknown.
const UNKNOWN_LABEL=/^(incerto|desconhecido|unknown)$/i;
export type CorpusCheckOptions={allowConversation?:boolean;allowUnlisted?:boolean;confirmPublic?:boolean};
export function checkCorpusSource(t:CorpusTranscript,{allowConversation=false,allowUnlisted=false,confirmPublic=false}:CorpusCheckOptions={}){
 const m=t.metadata;
 const labels=['tipo','categoria','formato','genero','gênero','classificacao','classificação','titulo','título','title','type','category']
  .map(k=>m[k]).filter(v=>typeof v==='string').join(' · ');
 if(PRIVATE.test(labels))throw Error(`Fonte recusada: supervisão ou material clínico (${labels})`);
 if(m.excluir===true||m.excluir===1)throw Error('Fonte recusada: vídeo marcado para exclusão no Corpus');
 const visibility=typeof m.visibilidade==='string'?m.visibilidade:null;
 if(visibility==='privado')throw Error('Fonte recusada: vídeo privado no YouTube');
 if(visibility&&visibility!=='publico'&&!allowUnlisted)throw Error(`Fonte recusada: vídeo ${visibility}. Só vídeos públicos; use --allow-unlisted se Diego autorizar este vídeo.`);
 if(typeof m.tipo!=='string'&&!visibility&&!confirmPublic)throw Error('Fonte sem registro no Corpus (tipo e visibilidade desconhecidos). Confira pelo MCP corpus-diego que é um vídeo público de Diego, sem supervisão, e repita com --confirm-public.');
 const catalogSpeakers=Array.isArray(m.falantes)?(m.falantes as unknown[]).map(String):[];
 const speakers=[...new Set([...t.segments.map(s=>s.speaker).filter(Boolean) as string[],...catalogSpeakers])];
 const others=speakers.filter(s=>!DIEGO.test(s)&&!UNKNOWN_LABEL.test(s));
 // Lives mix Diego with guests and read-aloud questions from the chat: treat them as conversations.
 const live=m.live_status==='concluida'||m.live_status==='ao_vivo';
 const conversation=CONVERSATION.test(labels)||live||others.length>0;
 if(conversation&&!allowConversation)throw Error(`Fonte recusada: ${live?'live (pode ter convidados e perguntas do chat)':'conversa com outros falantes'}${others.length?` (${others.join(', ')})`:''}. Só vídeos em que Diego fala sozinho; use --allow-conversation para uma conversa pública, e cite só as falas de Diego.`);
 return {speakers,conversation};
}
const clock=(s:number|null)=>s===null?'':`[${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}] `;
// Timestamps and speakers stay in the working transcript so the map can cite "where" and "who".
export function corpusTranscriptText(t:CorpusTranscript){
 if(!t.segments.length)return t.text;
 return t.segments.map(s=>`${clock(s.start)}${s.speaker?`(${s.speaker}) `:''}${s.text}`).join('\n');
}
export async function readCorpus(source:string){
 let raw:string,id:string|null;
 if(source.startsWith('corpus:')){
  id=source.slice(7);const file=corpusFile(id);
  raw=await readFile(file,'utf8').catch(e=>{if(e.code==='ENOENT')throw Error(`Transcrição não encontrada em ${file}. Defina CAROUSEL_CORPUS_DIR ou salve o v1.json obtido pelo MCP corpus-diego e use --source <arquivo.json>.`);throw e;});
 }else{
  // A v1.json copied from the Corpus keeps its video id as the folder name; any other file must carry `video_id`.
  const file=path.resolve(source);raw=await readFile(file,'utf8');
  id=path.basename(file)==='v1.json'?path.basename(path.dirname(file)):null;
 }
 const peek=parseCorpus(raw,id);
 const key=peek.id??id;
 const catalog=key?await corpusCatalog(key):null;
 const meta=key&&source.startsWith('corpus:')?await optionalJson(path.join(path.dirname(corpusFile(key)),'meta.json'))??{}:{};
 return {raw,transcript:parseCorpus(raw,key,{...meta,...(catalog??{})})};
}
