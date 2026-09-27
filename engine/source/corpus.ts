import os from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { optionalJson } from '../project/io.js';
import { normalizeSource } from './copy.js';
// Corpus Diego transcripts: <corpus>/transcricoes/<video_id>/v1.json with `texto`, `segmentos`, `palavras`.
// The reader is tolerant about field names (pt/en) because the export may evolve; anything it cannot read is an error.
export type CorpusSegment={start:number|null;end:number|null;speaker:string|null;text:string};
export type CorpusTranscript={id:string|null;title:string|null;text:string;segments:CorpusSegment[];metadata:Record<string,unknown>};
export function corpusDir(){
 return path.resolve(process.env.CAROUSEL_CORPUS_DIR||path.join(os.homedir(),'Library/Application Support/CorpusDiego/data'));
}
export const corpusFile=(id:string)=>{
 if(!/^[A-Za-z0-9_-]{3,64}$/.test(id))throw Error(`ID de vídeo inválido: ${id}`);
 return path.join(corpusDir(),'transcricoes',id,'v1.json');
};
const pick=(o:any,...keys:string[])=>{for(const k of keys)if(o?.[k]!==undefined&&o[k]!==null)return o[k];return undefined;};
const seconds=(v:unknown)=>typeof v==='number'?v:typeof v==='string'&&/^\d+(?:\.\d+)?$/.test(v)?Number(v):typeof v==='string'&&/^\d{1,2}(?::\d{2}){1,2}$/.test(v)?v.split(':').reduce((a,p)=>a*60+Number(p),0):null;
export function parseCorpus(raw:string,fallbackId:string|null=null,extra:Record<string,unknown>={}):CorpusTranscript{
 let data:any;try{data=JSON.parse(raw);}catch{throw Error('Transcrição do Corpus não é JSON válido');}
 const segments:CorpusSegment[]=(pick(data,'segmentos','segments')??[]).map((s:any,i:number)=>{
  const text=pick(s,'texto','text');if(typeof text!=='string')throw Error(`Segmento ${i+1} sem texto`);
  const speaker=pick(s,'falante','speaker','locutor');
  return {start:seconds(pick(s,'inicio','início','start')),end:seconds(pick(s,'fim','end')),speaker:typeof speaker==='string'&&speaker.trim()?speaker.trim():null,text:normalizeSource(text).trim()};
 });
 let text=pick(data,'texto','text');
 if(typeof text!=='string'){if(!segments.length)throw Error('Transcrição sem `texto` nem `segmentos`');text=segments.map(s=>s.text).join(' ');}
 const {texto:_t,text:_x,segmentos:_s,segments:_g,palavras:_p,words:_w,...rest}=data;
 const metadata={...rest,...extra};
 const title=pick(metadata,'titulo','título','title');
 return {id:String(pick(metadata,'video_id','id')??fallbackId??'')||null,title:typeof title==='string'?title:null,text:normalizeSource(text).trim(),segments,metadata};
}
// Supervisions, clinical sessions and conversations stay out: they carry third parties' cases and words.
const PRIVATE=/supervis|sess[aã]o cl[ií]nica|caso cl[ií]nico|atendimento/i;
const CONVERSATION=/conversa|entrevista|podcast|bate-?papo|live com|debate/i;
const DIEGO=/diego/i;
export function checkCorpusSource(t:CorpusTranscript,{allowConversation=false}={}){
 const labels=['tipo','categoria','formato','genero','gênero','classificacao','classificação','titulo','título','title','type','category']
  .map(k=>t.metadata[k]).filter(v=>typeof v==='string').join(' · ');
 if(PRIVATE.test(labels))throw Error(`Fonte recusada: supervisão ou material clínico (${labels})`);
 const speakers=[...new Set(t.segments.map(s=>s.speaker).filter(Boolean))] as string[];
 const others=speakers.filter(s=>!DIEGO.test(s));
 const conversation=CONVERSATION.test(labels)||others.length>0;
 if(conversation&&!allowConversation)throw Error(`Fonte recusada: conversa com outros falantes${others.length?` (${others.join(', ')})`:''}. Só vídeos em que Diego fala sozinho; use --allow-conversation para uma conversa pública, e cite só as falas de Diego.`);
 return {speakers,conversation};
}
const clock=(s:number|null)=>s===null?'':`[${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}] `;
// Timestamps and speakers stay in the working transcript so the map can cite "where" and "who".
export function corpusTranscriptText(t:CorpusTranscript){
 if(!t.segments.length)return t.text;
 return t.segments.map(s=>`${clock(s.start)}${s.speaker?`(${s.speaker}) `:''}${s.text}`).join('\n');
}
export async function readCorpus(source:string){
 if(source.startsWith('corpus:')){
  const id=source.slice(7),file=corpusFile(id);
  const raw=await readFile(file,'utf8').catch(e=>{if(e.code==='ENOENT')throw Error(`Transcrição não encontrada em ${file}. Defina CAROUSEL_CORPUS_DIR ou salve o v1.json obtido pelo MCP corpus-diego e use --source <arquivo.json>.`);throw e;});
  const meta=await optionalJson(path.join(path.dirname(file),'meta.json'))??{};
  return {raw,transcript:parseCorpus(raw,id,meta)};
 }
 const raw=await readFile(path.resolve(source),'utf8');
 // A v1.json copied from the Corpus keeps its video id as the folder name; any other file must carry `video_id`.
 const file=path.resolve(source);
 return {raw,transcript:parseCorpus(raw,path.basename(file)==='v1.json'?path.basename(path.dirname(file)):null)};
}
