import { it, expect } from 'vitest';
import { initialDirection, switchComposition } from './direction.js';
const slides=[{narrative_role:'interruption',body:null},{narrative_role:'conflict',body:'Um corpo curto.'},{narrative_role:'revelation',body:'Outro corpo curto.',visual_intent:'um copo de água do mar'}];
it('troca para composição de texto tira a imagem do slide e guarda como alternativa',()=>{
 const d=initialDirection('cinematic_condensed',slides)[2];expect(d.composition).toBe('cinematic_fade');
 d.image={...d.image,asset_id:'kaaaaaaaaaa',placeholder:false};
 const warning=switchComposition(d,'text_only',{body:true});
 expect(warning).toMatch(/alternativa/);
 expect(d).toMatchObject({composition:'text_only',density:'MEDIUM',layout:{headline_position:'center'},fit:{headline:'preferred'},image:{need:false,placeholder:false,strategy:'none',alternatives:['kaaaaaaaaaa']}});
 expect(d.image.asset_id).toBeUndefined();
});
it('troca entre composições com imagem mantém a imagem e ajusta posição e densidade',()=>{
 const d=initialDirection('cinematic_condensed',slides)[2];
 expect(switchComposition(d,'image_card',{body:true})).toBeUndefined();
 expect(d).toMatchObject({composition:'image_card',density:'HIGH',layout:{headline_position:'bottom'},image:{need:true,placeholder:true}});
 switchComposition(d,'full_bleed',{body:true});expect(d.layout.headline_position).toBe('top');
 const cover=initialDirection('cinematic_condensed',slides)[0];switchComposition(cover,'giant_statement',{cover:true,body:false});
 expect(cover).toMatchObject({density:'LOW',layout:{headline_position:'bottom'},fit:{headline:'fill'},image:{need:false,placeholder:false}});
});
it('slide de texto sem imagem troca de composição sem aviso; slot de imagem sem imagem vira placeholder declarado',()=>{
 const d=initialDirection('cinematic_condensed',slides)[1];expect(d.image.need).toBe(false);
 expect(switchComposition(d,'giant_statement',{body:true})).toBeUndefined();expect(d.fit.headline).toBe('fill');
 switchComposition(d,'cinematic_fade',{body:true});expect(d.image).toMatchObject({need:true,placeholder:true,strategy:'generated'});
 const typographic=initialDirection('cinematic_condensed',slides)[1];switchComposition(typographic,'full_bleed',{body:true});expect(typographic.image).toMatchObject({need:false,placeholder:false});
});
it('composition (CLI) grava na direção de arte, substitui o override do estúdio e mantém o lint limpo',async()=>{
 const {mkdtemp,mkdir,rm}=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path');
 const {ROOT,readJson,writeJson,loadProject}=await import('./io.js'),{importCopy}=await import('./create.js'),{visualLint}=await import('../qa/lint.js'),{setComposition}=await import('./direction.js');
 const dir=await mkdtemp(path.join(os.tmpdir(),'composition-'));
 try{
  await mkdir(path.join(dir,'source'));const c=await readJson(path.join(ROOT,'engine/schema/examples/carousel.json'));c.slides=[];await writeJson(path.join(dir,'carousel.json'),c);
  await writeJson(path.join(dir,'tweaks.json'),{schema_version:1,slides:{}});await writeJson(path.join(dir,'assets/manifest.json'),{schema_version:1,assets:[]});await importCopy(dir,path.join(ROOT,'fixtures/copy-pronta.md'));
  const id=(await loadProject(dir)).carousel.slides[3].id;await writeJson(path.join(dir,'tweaks.json'),{schema_version:1,slides:{[id]:{composition:'quote',params:{}}}});
  const r=await setComposition(dir,id,'image_card');expect(r).toMatchObject({from:'quote',to:'image_card',image:{need:true,placeholder:true}});
  const p=await loadProject(dir);expect(p.art.slides[id].layout.headline_position).toBe('bottom');expect(p.tweaks.slides[id]).toBeUndefined();expect(await visualLint(dir)).toEqual([]);
  const back=await setComposition(dir,id,'text_only');expect(back.warnings?.[0]).toMatch(/não exige mais imagem/);
  // copy-pronta: P3 giant_statement, P4 text_only, P5 text_only; a text_only at P3 makes three in a row.
  expect((await setComposition(dir,(await loadProject(dir)).carousel.slides[2].id,'text_only')).warnings?.at(-1)).toMatch(/ritmo/);
  expect((await visualLint(dir)).some(e=>e.includes('mais de duas composições iguais'))).toBe(true);
  await expect(setComposition(dir,id,'carrossel')).rejects.toThrow();
 }finally{await rm(dir,{recursive:true,force:true});}
});
