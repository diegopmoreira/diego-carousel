import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Carousel, VERSION, type CarouselData, type ArtData } from '../schema/index.js';
import { projectsDir, opaqueId, hash, writeJson, log, readJson } from './io.js';
import { cleanTranscript, parseCopy, toCopy } from '../source/copy.js';
import { readCorpus, checkCorpusSource, corpusTranscriptText } from '../source/corpus.js';
import { initialDirection, roleByPosition } from './direction.js';
export type CreateOptions={allowConversation?:boolean;allowUnlisted?:boolean;confirmPublic?:boolean};
// Sources: `copy` (ready copy, imported next), `corpus:<video_id>` or a Corpus v1.json file, or a plain .txt transcript.
export async function createProject(slug:string,source:string,options:CreateOptions={}){
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw Error('Slug: usa letras minúsculas, números e hífens');
 const corpus=source.startsWith('corpus:')||source.toLowerCase().endsWith('.json');
 let raw='',transcript='',type:'copy_input'|'transcript_file'|'corpus_video'='copy_input',ref=source,title=slug;
 if(corpus){
  const read=await readCorpus(source),check=checkCorpusSource(read.transcript,options);
  raw=read.raw;transcript=corpusTranscriptText(read.transcript);type='corpus_video';
  ref=read.transcript.id?`corpus:${read.transcript.id}`:path.basename(source);title=read.transcript.title??slug;
  if(check.conversation)transcript=`# Conversa: citar somente as falas de Diego (${check.speakers.join(', ')})\n\n`+transcript;
 }else if(source!=='copy'){raw=await readFile(path.resolve(source),'utf8');transcript=cleanTranscript(raw);type='transcript_file';ref=path.basename(source);}
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const dir=path.join(projectsDir(),`${date}-${slug}`);
 await mkdir(path.dirname(dir),{recursive:true});
 await mkdir(dir).catch(e=>{if(e.code==='EEXIST')throw Error(`Já existe um projeto ${path.basename(dir)} hoje: usa outro slug ou continua nele (${dir})`);throw e;});
 for(const d of ['source','assets/source','assets/generated/alternatives','assets/processed','html','fit','export','qa','preview'])await mkdir(path.join(dir,d),{recursive:true});
 const c=Carousel.parse({schema_version:1,project:{id:opaqueId(),created_at:new Date().toISOString(),engine_version:VERSION,skill_version:VERSION,language:'pt-BR',canvas:{width:1080,height:1350},mode:source==='copy'?'design-only':'full',copy_locked:source==='copy'},source:{type,ref,title,hash:hash(raw)},editorial:{cta:{type:'none',text:''}},slides:[]});
 await writeJson(path.join(dir,'carousel.json'),c);
 await writeJson(path.join(dir,'art-direction.json'),{schema_version:1,family:'editorial_clean',cover_strategy:'typographic',rationale:'Direção inicial; revisar antes de publicar.',slides:{}});
 await writeJson(path.join(dir,'tweaks.json'),{schema_version:1,slides:{}});
 await writeJson(path.join(dir,'assets/manifest.json'),{schema_version:1,assets:[]});
 await writeFile(path.join(dir,corpus?'source/original.json':'source/original.txt'),raw);
 await writeFile(path.join(dir,'source/transcript.txt'),transcript);
 await log(dir,'PROJECT',`Projeto criado (${type}: ${ref})`);return dir;
}
export async function importCopy(dir:string,file:string){
 const c:CarouselData=Carousel.parse(await readJson(path.join(dir,'carousel.json')));
 if(c.slides.length)throw Error('Importação inicial apenas: cria outro projeto para preservar copy e IDs existentes');
 const raw=await readFile(file,'utf8'),panels=parseCopy(raw);
 c.slides=panels.map((p,i)=>({id:opaqueId(),narrative_role:roleByPosition(i,panels.length),...p,headline_type:'statement',adds:[],next_question:'',visual_intent:''}));
 c.project.mode='design-only';c.project.copy_locked=true;c.source={type:'copy_input',ref:path.basename(file),title:c.source.title,hash:hash(raw)};
 Carousel.parse(c);
 // Ready copy: roles inferred by position, no required images (Diego adds photos in the studio).
 const art:ArtData={schema_version:1,family:'editorial_clean',cover_strategy:'typographic',rationale:'Direção inicial por função narrativa inferida da posição; revisar.',slides:{}};
 const direction=initialDirection(art.family,c.slides,{images:false});
 c.slides.forEach((s,i)=>{art.slides[s.id]=direction[i];});
 await writeFile(path.join(dir,'source/copy-input.md'),raw);
 await writeJson(path.join(dir,'carousel.json'),c);await writeJson(path.join(dir,'art-direction.json'),art);
 await writeFile(path.join(dir,'copy.md'),toCopy(c.slides));await log(dir,'COPY','Copy importada e travada; conteúdo preservado em NFC');
}
