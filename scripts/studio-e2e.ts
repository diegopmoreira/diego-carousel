import { launchChromium } from '../engine/render/browser.js';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,readFile,rm,readdir,writeFile,chmod } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';import os from 'node:os';
import { ROOT,readJson,writeJson,loadProject } from '../engine/project/io.js';
import { importCopy } from '../engine/project/create.js';
import { render } from '../engine/render/render.js';
import { serve } from '../engine/preview/server.js';
import { proposeVoice } from '../engine/qa/voice.js';
const dir=await mkdtemp(path.join(os.tmpdir(),'studio-e2e-'));let server:Awaited<ReturnType<typeof serve>>|undefined,browser:Awaited<ReturnType<typeof launchChromium>>|undefined;
// Everything this test creates lives in a temporary folder: real projects and fixtures stay untouched.
process.env.CAROUSEL_PROJECTS_DIR=path.join(dir,'projects');
const shots=process.env.STUDIO_SCREENSHOTS?path.resolve(process.env.STUDIO_SCREENSHOTS):dir;
try{
 await mkdir(path.join(dir,'source'));const c=await readJson(path.join(ROOT,'engine/schema/examples/carousel.json'));c.slides=[];await writeJson(path.join(dir,'carousel.json'),c);await writeJson(path.join(dir,'assets/manifest.json'),{schema_version:1,assets:[]});await writeJson(path.join(dir,'tweaks.json'),{schema_version:1,slides:{}});await importCopy(dir,path.join(ROOT,'fixtures/copy-pronta.md'));
 const before=await readFile(path.join(dir,'carousel.json'),'utf8'),first=await render(dir);
 server=await serve(dir,0,true);browser=await launchChromium();const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.url);await page.locator('#studio').waitFor({state:'visible'});assert.equal(await page.locator('#slides button').count(),10);
 const unauthorized=await page.request.post(server.url+'/api/render',{data:{revision:'x'}});assert.equal(unauthorized.status(),403);
 assert.equal((await page.request.get(server.url+'/api/download')).status(),403,'download exige token');
 const raw=async(pathname:string,host='127.0.0.1')=>{const port=new URL(server!.url).port;return new Promise<{status:number,headers:any}>((resolve,reject)=>{const r=http.request({host:'127.0.0.1',port,path:pathname,headers:{Host:`${host}:${port}`}},res=>{res.resume();resolve({status:res.statusCode!,headers:res.headers});});r.on('error',reject);r.end();});};
 assert.equal((await raw('/project/html/..%2Fcarousel.json')).status,404,'segmento codificado');
 assert.equal((await raw('/project/html/../carousel.json')).status,404,'traversal');
 assert.equal((await raw('/project/carousel.json')).status,404,'JSON do projeto fora da lista');
 assert.equal((await raw('/project/qa/carrossel.zip')).status,404,'ZIP só pela API');
 assert.equal((await raw('/project/qa/render/01.png','evil.example')).status,403,'Host estranho');
 const local=await raw('/project/qa/render/01.png','localhost');assert.equal(local.status,200,'localhost aceito');assert.match(local.headers['content-security-policy'],/frame-ancestors 'self'/);
 await page.locator('#slides button').nth(3).click();await page.locator('[name="headline_size_delta"]').evaluate((el:any)=>{el.value='6';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#notice')?.textContent==='Ajustes salvos. Preview atualizado.');
 // Live preview: moving a slider shows the slide HTML with the new size before saving.
 await page.locator('#slides button').nth(2).click();
 await page.locator('[name="headline_size_delta"]').evaluate((el:any)=>{el.value='10';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('#live').waitFor({state:'visible'});
 await page.waitForFunction(()=>{const d=(document.querySelector('#live-frame') as HTMLIFrameElement).contentDocument;const h=d?.querySelector('h1') as HTMLElement|null;return !!h&&h.style.fontSize!=='';});
 page.once('dialog',d=>d.accept());await page.locator('#slides button').nth(3).click();await page.locator('#live').waitFor({state:'hidden'});
 const edited=await readJson(path.join(dir,'render-manifest.json'));for(let i=0;i<10;i++)assert.equal(edited.slides[i].png_hash===first.slides[i].png_hash,i!==3);
 assert.equal(await readFile(path.join(dir,'carousel.json'),'utf8'),before);
 const state=await (await page.request.get(server.url+'/api/state')).json();
 const conflict=await page.request.post(server.url+'/api/adjust',{headers:{Origin:server.url,'X-Carousel-Token':state.token},data:{revision:'antiga',id:state.carousel.slides[0].id}});assert.equal(conflict.status(),409);
 // Instagram view and safe-area overlay.
 await page.locator('[data-view="instagram"]').click();await page.locator('#instagram').waitFor({state:'visible'});assert.ok((await page.locator('#ig-image').getAttribute('src'))?.includes('qa/render'));
 await page.locator('[data-view="slide"]').click();await page.locator('#safe-area').check();assert.equal(await page.locator('#safe-overlay').isVisible(),true);await page.locator('#safe-area').uncheck();
 // Server events: a change written outside the studio shows up without reloading.
 const tweaksFile=path.join(dir,'tweaks.json'),tw=await readJson(tweaksFile),someId=state.carousel.slides[5].id;tw.slides[someId]={params:{block_gap:30}};await writeJson(tweaksFile,tw);
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='Precisa atualizar',{},{timeout:10000});
 delete tw.slides[someId];await writeJson(tweaksFile,tw);await page.waitForFunction(()=>document.querySelector('#status')?.textContent!=='Precisa atualizar',{},{timeout:10000});
 await page.locator('#new-version').click();await page.locator('#variant-form [name="name"]').fill('cinematica');await page.locator('#variant-form button[type="submit"]').click();await page.waitForURL('**/*variant=cinematica');await page.locator('#studio').waitFor({state:'visible'});assert.equal((await loadProject(dir)).art.family,'editorial_clean');assert.equal((await loadProject(path.join(dir,'variants/cinematica'))).art.family,'cinematic_condensed');assert.equal(await readFile(path.join(dir,'carousel.json'),'utf8'),before);
 await page.locator('#version').selectOption('');await page.waitForURL(url=>!url.search);await page.locator('#studio').waitFor({state:'visible'});
 await page.locator('#export').click();await page.locator('#export-form [name="reviewer"]').fill('Teste automático');await page.locator('#export-form [name="confirmed"]').check();await page.locator('#export-form textarea').fill('Fixture automática isolada: teste técnico do download.');
 const downloadPromise=page.waitForEvent('download');await page.locator('#export-form button[type="submit"]').click();const download=await downloadPromise;const zip=path.join(dir,'test.zip');await download.saveAs(zip);
 execFileSync('python3',['-c','import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert len(z.namelist())==10; assert z.testzip() is None; assert all(z.read(n).startswith(bytes.fromhex("89504e470d0a1a0a")) for n in z.namelist())',zip]);
 assert.equal(errors.length,0,errors.join('\n'));
 await page.screenshot({path:path.join(shots,'studio-desktop.png')});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(shots,'studio-mobile.png')});
 // Creating a project from pasted copy must open a usable editor without shell steps.
 const slug='teste-interface-'+Date.now();const created=path.join(process.env.CAROUSEL_PROJECTS_DIR!,new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())+'-'+slug);
 await page.setViewportSize({width:1440,height:1000});await page.locator('#new-project').click();await page.locator('#create-form input[name="source"][value="copy"]').check();await page.locator('#create-form [name="slug"]').fill(slug);await page.locator('#create-form [name="copy"]').fill(await readFile(path.join(ROOT,'fixtures/copy-pronta.md'),'utf8'));await page.locator('#create-form button[type="submit"]').click();await page.waitForURL('**/*project=*');await page.locator('#studio').waitFor({state:'visible'});assert.equal(await page.locator('#slides button').count(),10);
 await page.locator('#upload-file').setInputFiles(path.join(ROOT,'design/brand/avatar-source.png'));await page.locator('#upload-form textarea').fill('Imagem do template local, usada somente neste teste.');await page.locator('#upload-form button[type="submit"]').click();await page.waitForFunction(()=>document.querySelector('#notice')?.textContent==='Imagem adicionada ao slide.');
 assert.equal((await loadProject(created)).assets.assets.length,1);assert.equal((await loadProject(created)).carousel.slides.length,10);
 // A composition carries the image decision: a text layout takes the image out (kept as an alternative) and an image
 // slot without an image waits for one, so the slide never lands in a state the export cannot finish.
 {const p=await loadProject(created),uploaded=p.assets.assets[0].id,coverId=p.carousel.slides[0].id,fourth=p.carousel.slides[3].id;
  // The notice keeps the text of the previous save: clear it, so the wait sees this save finish.
  const save=async()=>{await page.evaluate(()=>{document.querySelector('#notice')!.textContent='';});await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#notice')?.textContent==='Ajustes salvos. Preview atualizado.');};
  assert.equal(p.art.slides[coverId].image.asset_id,uploaded);
  await page.locator('#adjust-form [name="composition"]').selectOption('giant_statement');
  assert.equal(await page.locator('#adjust-form [name="asset_id"]').inputValue(),'');assert.equal(await page.locator('#adjust-form [name="image_need"]').isChecked(),false);
  await save();
  const q=await loadProject(created),cover=q.art.slides[coverId];assert.equal(cover.image.asset_id,undefined);assert.ok(cover.image.alternatives.includes(uploaded));assert.equal(cover.image.need,false);assert.equal(q.tweaks.slides[coverId]?.composition,'giant_statement');
  await page.locator('#slides button').nth(3).click();await page.locator('#adjust-form [name="composition"]').selectOption('cinematic_fade');
  assert.equal(await page.locator('#adjust-form [name="image_need"]').isChecked(),true);assert.equal(await page.locator('#adjust-form [name="position"]').inputValue(),'top');
  await save();
  const r=(await loadProject(created)).art.slides[fourth];assert.equal(r.image.need,true);assert.equal(r.image.placeholder,true);assert.equal(r.layout.headline_position,'top');}
 // Empty studio: with no project yet, the first carousel can be created from the screen.
 const emptyProjects=path.join(dir,'empty-projects');process.env.CAROUSEL_PROJECTS_DIR=emptyProjects;
 const empty=await serve(null,0,true);try{
  const p2=await browser!.newPage({viewport:{width:1440,height:1000}});await p2.goto(empty.url);await p2.locator('#create-dialog').waitFor({state:'visible'});
  await p2.locator('#create-form input[name="source"][value="copy"]').check();await p2.locator('#create-form [name="slug"]').fill('primeiro');await p2.locator('#create-form [name="copy"]').fill((await readFile(path.join(ROOT,'fixtures/copy-pronta.md'),'utf8')).replace('Tu não precisa vencer','Você não precisa vencer'));
  await p2.locator('#create-form button[type="submit"]').click();await p2.waitForURL('**/*project=*');await p2.locator('#studio').waitFor({state:'visible'});
  assert.equal(await p2.locator('#slides button').count(),10);
  // A voice proposal waits in the studio; Diego approves it on screen and the copy changes only then.
  const created=path.join(emptyProjects,(await readdir(emptyProjects))[0]);await proposeVoice(created);await p2.reload();
  await p2.locator('#pending').waitFor({state:'visible'});
  // A proposal changed after it was shown is never applied.
  const shown=await (await p2.request.get(empty.url+'/api/state?project='+path.basename(created))).json();
  const stale=await p2.request.post(empty.url+'/api/approve?project='+path.basename(created),{headers:{Origin:empty.url,'X-Carousel-Token':shown.token},data:{revision:shown.revision,type:'voice',hash:'0'.repeat(64),by:'Diego',confirmed:true}});
  assert.equal(stale.status(),409);assert.equal((await loadProject(created)).carousel.slides[0].headline,'Você não precisa vencer toda discussão');
  await p2.locator('#pending-open').click();
  await p2.locator('#approve-form [name="by"]').fill('Diego');await p2.locator('#approve-form [name="confirmed"]').check();await p2.locator('#approve-form button[type="submit"]').click();
  await p2.waitForFunction(()=>document.querySelector('#notice')?.textContent?.startsWith('Aprovado'));
  assert.equal((await loadProject(created)).carousel.slides[0].headline,'Tu não precisa vencer toda discussão');
  assert.equal((await readJson(path.join(created,'approvals.json'))).approvals[0].by,'Diego');await p2.close();
 }finally{await empty.close();process.env.CAROUSEL_PROJECTS_DIR=path.join(dir,'projects');}
 // From a transcript: the editorial agent (here a stand-in for claude -p with the fixture) writes the copy, and Diego
 // picks the thesis on screen between the two stages.
 const agentProjects=path.join(dir,'agent-projects'),fake=path.join(dir,'claude');process.env.CAROUSEL_PROJECTS_DIR=agentProjects;
 await writeFile(fake,`#!/bin/sh\nexec "${process.execPath}" "${path.join(ROOT,'scripts/fake-claude.mjs')}" "$@"\n`);await chmod(fake,0o755);
 process.env.CAROUSEL_CLAUDE_BIN=fake;process.env.CAROUSEL_TEST_NODE=process.execPath;
 const agentServer=await serve(null,0,true);try{
  const p3=await browser!.newPage({viewport:{width:1440,height:1000}});p3.on('pageerror',e=>errors.push(e.message));
  await p3.goto(agentServer.url);await p3.locator('#create-dialog').waitFor({state:'visible'});
  assert.equal(await p3.locator('#create-form [name="transcript"]').isVisible(),true,'a transcrição é o ponto de partida padrão');
  const transcript=['[0:00] Texto sintético de teste: alguém fala sobre a diferença entre sede e água salgada.','[0:20] Quem sente falta procura alívio rápido, e o alívio rápido aumenta a falta.','[0:40] Atenção não é vínculo; intensidade não é profundidade.','[1:00] A virada é escolher onde beber, não deixar de ter sede.','[1:20] Fecho: carência não se cura, se educa.'].join('\n').repeat(2);
  await p3.locator('#create-form [name="slug"]').fill('da-transcricao');await p3.locator('#create-form [name="transcript"]').fill(transcript);
  await p3.locator('#create-form button[type="submit"]').click();await p3.waitForFunction(()=>document.querySelector('#notice')?.textContent?.includes('vídeo público'));
  await p3.locator('#create-form [name="confirm_public"]').check();await p3.locator('#create-form button[type="submit"]').click();
  await p3.waitForURL('**/*project=*');await p3.locator('#agent-view').waitFor({state:'visible'});
  await p3.locator('#thesis-form').waitFor({state:'visible',timeout:60_000});
  assert.equal(await p3.locator('#thesis-options .option').count(),3);assert.equal(await p3.locator('#hook-options input:checked').getAttribute('value'),'h1');
  await p3.screenshot({path:path.join(shots,'studio-agent-thesis.png'),fullPage:true});
  // The hooks on offer belong to the recommended thesis: another thesis disables them.
  await p3.locator('#thesis-options input[value="t2"]').check();assert.equal(await p3.locator('#hook-options input[value="h2"]').isDisabled(),true);
  await p3.locator('#thesis-options input[value="t1"]').check();await p3.locator('#hook-options input[value="h2"]').check();
  await p3.locator('#thesis-form [name="note"]').fill('Fecha mais seco.');await p3.locator('#thesis-form [name="by"]').fill('Diego');
  await p3.locator('#thesis-form button[type="submit"]').click();
  await p3.locator('.workspace').waitFor({state:'visible',timeout:150_000});
  assert.equal(await p3.locator('#slides button').count(),10);
  const project=path.join(agentProjects,(await readdir(agentProjects))[0]),choice=await readJson(path.join(project,'qa/thesis-choice.json'));
  assert.equal(choice.by,'Diego');assert.equal(choice.hook,'h2');assert.equal(choice.note,'Fecha mais seco.');
  assert.equal((await readJson(path.join(project,'qa/agent.json'))).status,'done');
  await p3.screenshot({path:path.join(shots,'studio-agent-done.png')});await p3.close();assert.equal(errors.length,0,errors.join('\n'));
 }finally{await agentServer.close();process.env.CAROUSEL_PROJECTS_DIR=path.join(dir,'projects');delete process.env.CAROUSEL_CLAUDE_BIN;}
 console.log('Estúdio E2E aprovado: UI, prévia ao vivo, Instagram, área segura, eventos do servidor, estúdio vazio, transcrição → agente → escolha da tese → slides, aprovação de proposta, ajuste isolado, composição com a decisão de imagem, copy preservada, versão, proteção de escrita, revisão e ZIP íntegro.');
}finally{await browser?.close();await server?.close();await rm(dir,{recursive:true,force:true});}
