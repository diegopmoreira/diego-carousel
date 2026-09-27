import type { ArtData } from '../schema/index.js';
type Composition=ArtData['slides'][string]['composition'];type Family=ArtData['family'];
// First visual draft by narrative function (visual/art-direction.md). Claude revises it; the studio tweaks it.
const PLAN:Record<Family,Record<string,Composition>>={
 cinematic_condensed:{interruption:'full_bleed',conflict:'text_only',revelation:'cinematic_fade',mechanism:'cinematic_fade',contrast:'contrast',example:'cinematic_fade',escalation:'text_only',second_turn:'giant_statement',reorganization:'text_only',hammer:'giant_statement'},
 editorial_clean:{interruption:'full_bleed',conflict:'text_only',revelation:'giant_statement',mechanism:'text_only',contrast:'contrast',example:'image_card',escalation:'text_only',second_turn:'giant_statement',reorganization:'text_only',hammer:'giant_statement'},
};
export const WITH_IMAGE=new Set<Composition>(['full_bleed','cinematic_fade','image_card']);
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
  const s=slides[i],cover=i===0,image=WITH_IMAGE.has(composition),needed=images&&image;
  return {visual_role:s.narrative_role,composition,density:(image&&s.body?'HIGH':s.body?'MEDIUM':'LOW') as 'LOW'|'MEDIUM'|'HIGH',
   layout:{headline_position:cover?'bottom':image?'top':'center',align:cover&&family==='editorial_clean'?'center':'left'} as ArtData['slides'][string]['layout'],
   image:{need:needed,placeholder:needed,concept:s.visual_intent??'',mood:'',subject_priority:'',crop:'cover',negative_space:cover?'lower third':'',strategy:needed?'generated':'none',alternatives:[],focal_point:{x:.5,y:composition==='cinematic_fade'?.4:.5}} as ArtData['slides'][string]['image'],
   fit:{headline:(cover||composition==='giant_statement')?'fill':'preferred'} as ArtData['slides'][string]['fit']};
 });
}
