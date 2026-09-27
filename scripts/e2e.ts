import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {ROOT,readJson,writeJson,hash} from '../engine/project/io.js';
import {render,validate,exportProject,review} from '../engine/render/render.js';
import {importCopy,createProject} from '../engine/project/create.js';
import {draft} from '../engine/project/draft.js';
const dir=await mkdtemp(path.join(os.tmpdir(),'diego-carousel-e2e-'));
try{
 for(const name of ['source','qa','assets'])await mkdir(path.join(dir,name),{recursive:true});
 await writeJson(path.join(dir,'carousel.json'),{schema_version:1,project:{id:'ktest',created_at:new Date().toISOString(),skill_version:'0.1.0',engine_version:'0.1.0',language:'pt-BR',canvas:{width:1080,height:1350},mode:'design-only',copy_locked:true},source:{type:'copy_input',ref:'fixture',title:'E2E',hash:hash('')},editorial:{cta:{type:'none',text:''}},slides:[]});
 await writeJson(path.join(dir,'tweaks.json'),{schema_version:1,slides:{}});await writeJson(path.join(dir,'assets/manifest.json'),{schema_version:1,assets:[]});
 await importCopy(dir,path.join(ROOT,'fixtures/copy-pronta.md'));
 const c=await readJson(path.join(dir,'carousel.json'));const a=await readJson(path.join(dir,'art-direction.json'));
 // Exercise every composition, both font families and uppercase Portuguese accents.
 const compositions=['full_bleed','cinematic_fade','image_card','text_only','giant_statement','minimal_pause','quote','contrast','text_only','giant_statement'];
 for(let i=0;i<c.slides.length;i++){a.slides[c.slides[i].id].composition=compositions[i];a.slides[c.slides[i].id].image.need=false;}
 await writeJson(path.join(dir,'art-direction.json'),a);
 const b=await render(dir);assert.equal(b.slides.length,10);assert.ok(b.slides.every(s=>s.passed),JSON.stringify(b.slides.filter(s=>!s.passed)));
 assert.equal((await validate(dir)).passed,true);
 await assert.rejects(exportProject(dir),/Revisão visual/);
 const target=c.slides[3].id;
 await writeJson(path.join(dir,'tweaks.json'),{schema_version:1,slides:{[target]:{params:{headline_size_delta:6}}}});
 assert.equal((await validate(dir)).passed,false,'stale render must be refused');
 const edited=await render(dir);
 for(const old of b.slides){const now=edited.slides.find(s=>s.id===old.id);assert.equal(now.png_hash===old.png_hash,old.id!==target,'only the adjusted slide changes');}
 a.family='cinematic_condensed';await writeJson(path.join(dir,'art-direction.json'),a);
 const familyA=await render(dir);assert.ok(familyA.slides.every(s=>s.passed),JSON.stringify(familyA.slides.filter(s=>!s.passed)));
 // Ink map ran on every slide and left no collision behind.
 for(const r of familyA.slides){const fit=await readJson(path.join(dir,`fit/${r.id}.json`));assert.ok(fit.ink&&fit.ink.errors.length===0,JSON.stringify(fit.ink));}
 // Review cycles: counted per distinct render reviewed by the agent; the name never bypasses the limit.
 const agent={name:'Diego',kind:'agent' as const};
 await review(dir,agent,'ciclo 1',false);await review(dir,agent,'mesmo render, mesmo ciclo',false);
 for(const delta of [2,3]){await writeJson(path.join(dir,'tweaks.json'),{schema_version:1,slides:{[target]:{params:{headline_size_delta:delta}}}});await render(dir);await review(dir,agent,`delta ${delta}`,false);}
 assert.equal((await readJson(path.join(dir,'qa/visual-review.json'))).cycles,3);
 await writeJson(path.join(dir,'tweaks.json'),{schema_version:1,slides:{[target]:{params:{headline_size_delta:4}}}});await render(dir);
 await assert.rejects(review(dir,agent,'quarto ciclo',true),/revisão humana/);
 await review(dir,{name:'Diego',kind:'human'},'Conferido por uma pessoa.',true);
 await review(dir,agent,'após revisão humana o contador recomeça',true);assert.equal((await readJson(path.join(dir,'qa/visual-review.json'))).cycles,1);
 // Tampered output must never pass validation.
 await writeFile(path.join(dir,'qa/render/01.png'),'corrupt');assert.equal((await validate(dir)).passed,false);
 // A design-only overflow must remain byte-for-byte unchanged.
 const source=await readFile(path.join(ROOT,'fixtures/copy-pronta.md'),'utf8');
 const long=source.replace('Quando alguém discorda de ti,',('AÇÃO NÃO É obrigação. Tu pode escolher uma resposta concreta. ').repeat(65)+' Quando alguém discorda de ti,');
 c.slides=[];await writeJson(path.join(dir,'carousel.json'),c);await writeJson(path.join(dir,'tweaks.json'),{schema_version:1,slides:{}});
 const input=path.join(dir,'long-copy.md');await writeFile(input,long);await importCopy(dir,input);
 const before=await readFile(path.join(dir,'carousel.json'),'utf8');const overflow=await render(dir);assert.ok(overflow.slides.some(s=>!s.passed),'overflow must be reported');assert.equal(await readFile(path.join(dir,'carousel.json'),'utf8'),before);assert.equal((await validate(dir)).passed,false);
 // A glyph outside the vendored fonts must be reported, wherever it appears.
 c.slides=[];await writeJson(path.join(dir,'carousel.json'),c);await writeJson(path.join(dir,'tweaks.json'),{schema_version:1,slides:{}});
 const glyph=path.join(dir,'glyph-copy.md');await writeFile(glyph,source.replace('Tu não precisa vencer toda discussão','Tu não precisa vencer toda discussão ★'));await importCopy(dir,glyph);
 const fallback=await render(dir);assert.ok(fallback.slides[0].errors.some((e:string)=>/fallback/.test(e)),JSON.stringify(fallback.slides[0].errors));
 // Full mode: Corpus source → draft with editorial metadata → lint → render; export waits for the images.
 process.env.CAROUSEL_PROJECTS_DIR=path.join(dir,'projects');process.env.CAROUSEL_CORPUS_DIR=path.join(ROOT,'fixtures/corpus');
 const fullDir=await createProject('fluxo-full','corpus:exemplo-publico');
 await writeFile(path.join(fullDir,'editorial-report.md'),await readFile(path.join(ROOT,'fixtures/full/editorial-report.md'),'utf8'));
 await draft(fullDir,path.join(ROOT,'fixtures/full/copy.md'),path.join(ROOT,'fixtures/full/editorial.json'));
 const fullRender=await render(fullDir);assert.ok(fullRender.slides.every((s:any)=>s.passed),JSON.stringify(fullRender.slides.filter((s:any)=>!s.passed)));
 const fullValidation=await validate(fullDir);assert.ok(!fullValidation.passed&&fullValidation.errors.every((e:string)=>/placeholder/.test(e)),JSON.stringify(fullValidation.errors));
 console.log('E2E aprovado: duas famílias, oito composições, gate de revisão, hashes, rerender isolado, overflow sem reescrita, fonte fallback detectada e fluxo full (Corpus → draft → render).');
}finally{await rm(dir,{recursive:true,force:true});}
