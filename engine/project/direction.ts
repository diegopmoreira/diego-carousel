import path from 'node:path';
import { IMAGE_COMPOSITIONS, ArtDirection, Composition as CompositionSchema, type ArtData } from '../schema/index.js';
import { loadProject, writeJson, withLock, log } from './io.js';
type Composition=ArtData['slides'][string]['composition'];type Family=ArtData['family'];
// First visual draft by narrative function (visual/art-direction.md). Claude revises it; the studio tweaks it.
const PLAN:Record<Family,Record<string,Composition>>={
 cinematic_condensed:{interruption:'full_bleed',conflict:'text_only',revelation:'cinematic_fade',mechanism:'cinematic_fade',contrast:'contrast',example:'cinematic_fade',escalation:'text_only',second_turn:'giant_statement',reorganization:'text_only',hammer:'giant_statement'},
 editorial_clean:{interruption:'full_bleed',conflict:'text_only',revelation:'giant_statement',mechanism:'text_only',contrast:'contrast',example:'image_card',escalation:'text_only',second_turn:'giant_statement',reorganization:'text_only',hammer:'giant_statement'},
};
type Direction=ArtData['slides'][string];
const WITH_IMAGE=new Set(IMAGE_COMPOSITIONS as Composition[]);
// Where the text block sits by default: covers and image_card at the bottom (image_card text right above the card,
// calibrated on post7:7), under a top image at the top, text layouts centered.
export function positionFor(composition:Composition,cover:boolean):Direction['layout']['headline_position']{return cover||composition==='image_card'?'bottom':WITH_IMAGE.has(composition)?'top':'center';}
const fitFor=(composition:Composition,cover:boolean):Direction['fit']['headline']=>cover||composition==='giant_statement'?'fill':'preferred';
const densityFor=(composition:Composition,body:boolean):Direction['density']=>WITH_IMAGE.has(composition)&&body?'HIGH':body?'MEDIUM':'LOW';
// Changing a slide's composition carries the fields that go with it (text position, headline fit, density and, in a
// text layout, the image), so fit-probe measures exactly what autofit applies and a text layout never keeps an image
// requirement it cannot show. The image leaves the slide as an alternative. Returns a warning when the image left.
export function switchComposition(d:Direction,composition:Composition,{cover=false,body=true}:{cover?:boolean;body?:boolean}={}):string|undefined{
 d.composition=composition;d.layout={...d.layout,headline_position:positionFor(composition,cover)};d.fit={...d.fit,headline:fitFor(composition,cover)};d.density=densityFor(composition,body);
 if(WITH_IMAGE.has(composition)){
  // An image slot without a picture waits for one as a declared placeholder (a full_bleed may stay typographic).
  if(composition!=='full_bleed'&&!d.image.asset_id&&!d.image.placeholder)d.image={...d.image,need:true,placeholder:true,strategy:d.image.strategy==='none'?'generated':d.image.strategy};
  return;
 }
 if(!(d.image.asset_id||d.image.need||d.image.placeholder))return;
 const {asset_id,...image}=d.image;
 d.image={...image,need:false,placeholder:false,strategy:'none',alternatives:[...new Set([...image.alternatives,...(asset_id?[asset_id]:[])])]};
 return `imagem retirada deste slide (${asset_id?'fica como alternativa':'não exige mais imagem'}): ${composition} não tem imagem`;
}
const ALTERNATE:Record<Composition,Composition>={text_only:'quote',cinematic_fade:'text_only',image_card:'text_only',giant_statement:'minimal_pause',contrast:'text_only',quote:'text_only',minimal_pause:'giant_statement',full_bleed:'cinematic_fade'};
// Ready copy has no roles: infer them from the position in the base architecture (editorial/narrative-architectures.md).
export function roleByPosition(i:number,n:number){
 if(i===0)return 'interruption';if(i===n-1)return 'hammer';if(i===1)return 'conflict';if(i===2)return 'revelation';
 if(i===n-2)return 'reorganization';if(i===n-3)return 'second_turn';if(i===n-4&&n>=9)return 'escalation';return 'mechanism';
}
export function initialDirection(family:Family,slides:{narrative_role:string;body:string|null;visual_intent?:string}[],{images=true}={}){
 const comps:Composition[]=slides.map((s,i)=>{
  if(i===0)return 'full_bleed';
  let c=PLAN[family][s.narrative_role]??(s.body?'text_only':'giant_statement');
  if(!s.body&&(c==='text_only'||c==='contrast'||c==='quote'))c='giant_statement';
  // A statement is short: with a real body the slide is an argument, not a pause.
  if(c==='giant_statement'&&s.body&&s.body.replace(/\*\*/g,'').length>160)c='text_only';
  if(family==='editorial_clean'&&s.narrative_role==='mechanism'&&i%3===2)c='image_card'; // an image every few mechanisms keeps rhythm
  if(!images&&WITH_IMAGE.has(c))c=s.body?'text_only':'giant_statement';
  return c;
 });
 // Never three equal compositions in a row (visual lint): the third takes an alternate.
 for(let i=2;i<comps.length;i++)if(comps[i]===comps[i-1]&&comps[i]===comps[i-2]){let alt=ALTERNATE[comps[i]];if(!images&&WITH_IMAGE.has(alt))alt='quote';if(!slides[i].body&&alt==='quote')alt='minimal_pause';comps[i]=alt;}
 return comps.map((composition,i)=>{
  const s=slides[i],cover=i===0,needed=images&&WITH_IMAGE.has(composition);
  return {visual_role:s.narrative_role,composition,density:densityFor(composition,!!s.body),
   layout:{headline_position:positionFor(composition,cover),align:cover&&family==='editorial_clean'?'center':'left'} as Direction['layout'],
   image:{need:needed,placeholder:needed,concept:s.visual_intent??'',mood:'',subject_priority:'',crop:'cover',negative_space:cover?'lower third':'',strategy:needed?'generated':'none',alternatives:[],focal_point:{x:.5,y:composition==='cinematic_fade'?.4:.5}} as Direction['image'],
   fit:{headline:fitFor(composition,cover)}} satisfies Direction;
 });
}
// Claude's decision to change a slide's composition (CLI): written to the art direction with the fields that go with
// it, replacing a studio override of the composition. Never edit only the composition field by hand.
export function setComposition(dir:string,slide:string,value:string){return withLock(dir,async()=>{
 const composition=CompositionSchema.parse(value),p=await loadProject(dir),i=p.carousel.slides.findIndex(s=>s.id===slide);
 if(i<0)throw Error('Slide desconhecido');
 const d=p.art.slides[slide],from=p.tweaks.slides[slide]?.composition??d.composition;
 const warning=switchComposition(d,composition,{cover:i===0,body:!!p.carousel.slides[i].body});
 const tweak=p.tweaks.slides[slide];if(tweak){delete tweak.composition;if(!Object.keys(tweak.params).length)delete p.tweaks.slides[slide];}
 ArtDirection.parse(p.art);await writeJson(path.join(dir,'art-direction.json'),p.art);await writeJson(path.join(dir,'tweaks.json'),p.tweaks);
 await log(dir,'ART',`${slide}: composição ${from} → ${composition}${warning?`; ${warning}`:''}`);
 return {slide,from,to:composition,layout:d.layout,image:{need:d.image.need,placeholder:d.image.placeholder,asset_id:d.image.asset_id??null},...(warning?{warning}:{})};
});}
