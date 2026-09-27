import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Carousel, VERSION, type CarouselData, type ArtData } from '../schema/index.js';
import { projectsDir, opaqueId, hash, writeJson, log, readJson } from './io.js';
import { cleanTranscript, parseCopy, toCopy } from '../source/copy.js';
export async function createProject(slug:string,source:string){
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw Error('Slug: usa letras minúsculas, números e hífens');
 if(source.startsWith('corpus:'))throw Error('Ingestão do Corpus pendente: exporta uma transcrição pública para .txt; supervisões não são aceitas.');
 const raw=source==='copy'?'':await readFile(path.resolve(source),'utf8');
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const dir=path.join(projectsDir(),`${date}-${slug}`);
 await mkdir(path.dirname(dir),{recursive:true});await mkdir(dir);
 for(const d of ['source','assets/source','assets/generated/alternatives','assets/processed','html','fit','export','qa','preview'])await mkdir(path.join(dir,d),{recursive:true});
 const c=Carousel.parse({schema_version:1,$schema:'../../engine/schema/generated/carousel.schema.json',project:{id:opaqueId(),created_at:new Date().toISOString(),engine_version:VERSION,skill_version:VERSION,language:'pt-BR',canvas:{width:1080,height:1350},mode:source==='copy'?'design-only':'full',copy_locked:source==='copy'},source:{type:source==='copy'?'copy_input':'transcript_file',ref:source,title:slug,hash:hash(raw)},editorial:{cta:{type:'none',text:''}},slides:[]});
 await writeJson(path.join(dir,'carousel.json'),c);
 await writeJson(path.join(dir,'art-direction.json'),{schema_version:1,family:'editorial_clean',cover_strategy:'typographic',rationale:'Direção inicial; revisar antes de publicar.',slides:{}});
 await writeJson(path.join(dir,'tweaks.json'),{schema_version:1,slides:{}});
 await writeJson(path.join(dir,'assets/manifest.json'),{schema_version:1,assets:[]});
 await writeFile(path.join(dir,'source/original.txt'),raw);
 await writeFile(path.join(dir,'source/transcript.txt'),cleanTranscript(raw));
 await log(dir,'PROJECT','Projeto criado');return dir;
}
export async function importCopy(dir:string,file:string){
 const c:CarouselData=Carousel.parse(await readJson(path.join(dir,'carousel.json')));
 if(c.slides.length)throw Error('Importação inicial apenas: cria outro projeto para preservar copy e IDs existentes');
 const raw=await readFile(file,'utf8'),panels=parseCopy(raw);
 c.slides=panels.map((p,i)=>({id:opaqueId(),narrative_role:i===0?'hook':i===panels.length-1?'closing':'development',...p,headline_type:'statement',adds:[],next_question:'',visual_intent:''}));
 c.project.mode='design-only';c.project.copy_locked=true;c.source={type:'copy_input',ref:path.basename(file),title:c.source.title,hash:hash(raw)};
 Carousel.parse(c);
 const art:ArtData={schema_version:1,family:'editorial_clean',cover_strategy:'typographic',rationale:'Alternância tipográfica inicial; revisar intenção editorial.',slides:{}};
 c.slides.forEach((s,i)=>{art.slides[s.id]={visual_role:s.narrative_role,composition:i===0?'full_bleed':s.body?(['text_only','quote','text_only','contrast'] as const)[i%4]:i%2?'minimal_pause':'giant_statement',density:s.body?'MEDIUM':'LOW',layout:{headline_position:i===0?'bottom':'top',align:i===0?'center':'left'},image:{need:false,placeholder:false,concept:'',mood:'',subject_priority:'',crop:'cover',negative_space:'',strategy:'none',alternatives:[],focal_point:{x:.5,y:.5}},fit:{headline:i===0?'fill':'preferred'}};});
 await writeFile(path.join(dir,'source/copy-input.md'),raw);
 await writeJson(path.join(dir,'carousel.json'),c);await writeJson(path.join(dir,'art-direction.json'),art);
 await writeFile(path.join(dir,'copy.md'),toCopy(c.slides));await log(dir,'COPY','Copy importada e travada; conteúdo preservado em NFC');
}
