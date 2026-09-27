import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir,readdir} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {ROOT,readJson,writeJson,hash,loadProject} from '../engine/project/io.js';
import {render,validate,exportProject,review} from '../engine/render/render.js';
import {importCopy,createProject} from '../engine/project/create.js';
import {draft} from '../engine/project/draft.js';
import {addAsset} from '../engine/project/assets.js';
import {requestAsset,addFromRequest} from '../engine/project/requests.js';
import {candidates} from '../engine/render/candidates.js';
import {listVariants,createVariant} from '../engine/project/variants.js';
import {autofit,fitProbe} from '../engine/render/fitprobe.js';
import {IMAGE_COMPOSITIONS} from '../engine/schema/index.js';
import sharp from 'sharp';
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
 // Image compositions get a real (generated) picture: an empty image slot is refused by the visual lint.
 for(let i=0;i<3;i++)await addAsset(dir,await sharp({create:{width:1200,height:1500,channels:3,background:['#3a3530','#2f3a40','#403a2f'][i]}}).png().toBuffer(),'Imagem sintética do teste',c.slides[i].id);
 Object.assign(a,await readJson(path.join(dir,'art-direction.json')));
 const b=await render(dir);assert.equal(b.slides.length,10);assert.ok(b.slides.every(s=>s.passed),JSON.stringify(b.slides.filter(s=>!s.passed)));
 assert.equal((await validate(dir)).passed,true);
 await assert.rejects(exportProject(dir),/Revisão visual/);
 // Export with sync_dir: approved PNGs and the ZIP are copied to the synced folder.
 const sync=path.join(dir,'sync'),config=await readJson(path.join(ROOT,'config.json'));config.export.sync_dir=sync;await writeJson(path.join(dir,'config.json'),config);process.env.CAROUSEL_CONFIG=path.join(dir,'config.json');
 await mkdir(path.join(sync,path.basename(dir)),{recursive:true});await writeFile(path.join(sync,path.basename(dir),'11.png'),'antigo');
 await review(dir,{name:'Teste',kind:'human'},'Conferido no teste automático.',true);await exportProject(dir);
 assert.equal((await readdir(path.join(sync,path.basename(dir)))).filter(f=>f.endsWith('.png')).length,10,'sync folder mirrors the export');delete process.env.CAROUSEL_CONFIG;
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
 // Images: a cover ticket, two results (current + alternative) and the candidates sheet with the real headline.
 const cover=(await loadProject(fullDir)).carousel.slides[0].id,ticket=await requestAsset(fullDir,cover,{variants:2,concept:'a glass of water on a dark table'});
 for(const color of ['#2a3140','#40302a'])await addFromRequest(fullDir,ticket.id,{bytes:await sharp({create:{width:1088,height:1360,channels:3,background:color}}).png().toBuffer()});
 const sheet=await candidates(fullDir,cover);assert.equal(sheet.images.length,2);assert.equal((await sharp(sheet.sheet).metadata()).width,2*(432+16)+16);
 assert.deepEqual(await listVariants(fullDir),[],'temporary candidate variants are removed');
 const withCover=await render(fullDir);assert.ok(withCover.slides.every((s:any)=>s.passed));
 // With images still pending, the QA cycle can be recorded, but export stays blocked.
 await review(fullDir,{name:'Claude',kind:'agent'},'Leitura e ritmo conferidos; faltam as imagens.',false);
 assert.equal((await readJson(path.join(fullDir,'qa/visual-review.json'))).pending_images>0,true);
 await assert.rejects(exportProject(fullDir),/placeholder/);
 const fullValidation=await validate(fullDir);assert.ok(!fullValidation.passed&&fullValidation.errors.every((e:string)=>/placeholder/.test(e)),JSON.stringify(fullValidation.errors));
 // Placeholder notes never reach an export, so a character outside the fonts there is not a fallback failure.
 {const a2=await readJson(path.join(fullDir,'art-direction.json')),ph=Object.entries<any>(a2.slides).find(([,d])=>d.image.placeholder&&!d.image.asset_id)![0];a2.slides[ph].image.concept='sede → água salgada → poça';await writeJson(path.join(fullDir,'art-direction.json'),a2);
  const r2=await render(fullDir);assert.ok(r2.slides.every((x:any)=>x.passed),JSON.stringify(r2.slides.filter((x:any)=>!x.passed)));}
 // autofit on an image slide whose text cannot fit: the change goes to the art direction with the fields that go with
 // it; an image slot is kept when one holds the text (otherwise the image leaves as an alternative), never a
 // requirement the layout cannot show; and the next render passes.
 {const p3=await loadProject(fullDir),fade=p3.carousel.slides.findIndex(x=>p3.art.slides[x.id].composition==='cinematic_fade'),fadeId=p3.carousel.slides[fade].id;
  const long='Tu responde antes de terminar de ouvir porque a pergunta parece um ataque, e o ataque pede defesa imediata. Só que a defesa chega antes da compreensão, e tu passa a discutir com uma frase que o outro nem disse. Quando isso vira hábito, cada conversa difícil vira um tribunal em que tu é réu e advogado ao mesmo tempo. A escuta exige tolerar alguns segundos de desconforto sem resolver nada, e esse intervalo é justamente o que a pressa não permite.';
  const copy=(await readFile(path.join(fullDir,'copy.md'),'utf8')).split('\n\n');const block=copy.findIndex(b=>b.startsWith(`P${fade+1}\n`));const [marker,head]=copy[block].split('\n');copy[block]=[marker,head,long].join('\n');
  await writeFile(path.join(fullDir,'long.md'),copy.join('\n\n'));await draft(fullDir,path.join(fullDir,'long.md'));
  const before=await render(fullDir);assert.equal(before.slides.find((x:any)=>x.id===fadeId).passed,false,'long body must not fit under the image');
  const fixed=await autofit(fullDir);const change=fixed.changes.find(x=>x.slide===fadeId)!;assert.equal(change.changed,true,JSON.stringify(fixed));
  const d=(await loadProject(fullDir)).art.slides[fadeId];assert.notEqual(d.composition,'cinematic_fade');assert.equal(change.to,d.composition);
  assert.ok(IMAGE_COMPOSITIONS.includes(d.composition)||(!d.image.need&&!d.image.placeholder),JSON.stringify(d));
  assert.equal((await readJson(path.join(fullDir,'tweaks.json'))).slides[fadeId]?.composition,undefined);
  const after=await render(fullDir);assert.ok(after.slides.find((x:any)=>x.id===fadeId).passed,JSON.stringify(after.slides.find((x:any)=>x.id===fadeId)));}
 // fit-probe on a version measures that version's family.
 {const v=await createVariant(fullDir,'clean','editorial_clean'),first=(await loadProject(v)).carousel.slides[1].id;
  const probe=await fitProbe(v,first);const text=probe.results.find(r=>r.composition==='text_only'||r.composition==='quote');assert.equal(text?.headline_px,60,JSON.stringify(probe.results));}
 console.log('E2E aprovado: duas famílias, oito composições, gate de revisão, hashes, rerender isolado, overflow sem reescrita, fonte fallback detectada, fluxo full (Corpus → draft → render), autofit com imagem e fit-probe em versão.');
}finally{await rm(dir,{recursive:true,force:true});}
