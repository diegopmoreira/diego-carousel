import { launchChromium } from '../engine/render/browser.js';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,readFile,rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';import os from 'node:os';
import { ROOT,readJson,writeJson,loadProject } from '../engine/project/io.js';
import { importCopy } from '../engine/project/create.js';
import { render } from '../engine/render/render.js';
import { serve } from '../engine/preview/server.js';
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
 await page.locator('#export').click();await page.locator('#export-form [name="reviewer"]').fill('Teste automático');await page.locator('[name="confirmed"]').check();await page.locator('#export-form textarea').fill('Fixture automática isolada: teste técnico do download.');
 const downloadPromise=page.waitForEvent('download');await page.locator('#export-form button[type="submit"]').click();const download=await downloadPromise;const zip=path.join(dir,'test.zip');await download.saveAs(zip);
 execFileSync('python3',['-c','import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert len(z.namelist())==10; assert z.testzip() is None; assert all(z.read(n).startswith(bytes.fromhex("89504e470d0a1a0a")) for n in z.namelist())',zip]);
 assert.equal(errors.length,0,errors.join('\n'));
 await page.screenshot({path:path.join(shots,'studio-desktop.png')});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(shots,'studio-mobile.png')});
 // Creating a project from pasted copy must open a usable editor without shell steps.
 const slug='teste-interface-'+Date.now();const created=path.join(process.env.CAROUSEL_PROJECTS_DIR!,new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())+'-'+slug);
 await page.setViewportSize({width:1440,height:1000});await page.locator('#new-project').click();await page.locator('#create-form [name="slug"]').fill(slug);await page.locator('#create-form [name="copy"]').fill(await readFile(path.join(ROOT,'fixtures/copy-pronta.md'),'utf8'));await page.locator('#create-form button[type="submit"]').click();await page.waitForURL('**/*project=*');await page.locator('#studio').waitFor({state:'visible'});assert.equal(await page.locator('#slides button').count(),10);
 await page.locator('#upload-file').setInputFiles(path.join(ROOT,'design/brand/avatar-source.png'));await page.locator('#upload-form textarea').fill('Imagem do template local, usada somente neste teste.');await page.locator('#upload-form button[type="submit"]').click();await page.waitForFunction(()=>document.querySelector('#notice')?.textContent==='Imagem adicionada ao slide.');
 assert.equal((await loadProject(created)).assets.assets.length,1);assert.equal((await loadProject(created)).carousel.slides.length,10);
 console.log('Estúdio E2E aprovado: UI, prévia ao vivo, Instagram, área segura, eventos do servidor, ajuste isolado, copy preservada, versão, proteção de escrita, revisão e ZIP íntegro.');
}finally{await browser?.close();await server?.close();await rm(dir,{recursive:true,force:true});}
