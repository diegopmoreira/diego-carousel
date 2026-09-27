import type { CarouselData, ArtData, TweaksData } from '../schema/index.js';
import { emphasis } from '../source/copy.js';
// The check is drawn, not typed: U+2713 is outside the vendored font subsets and would fall back to a system font.
const VERIFIED='<svg class="verified" viewBox="0 0 24 24" aria-label="verificado"><circle cx="12" cy="12" r="12" fill="#1976D2"/><path d="M6.8 12.4l3.4 3.3 7-7.2" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const FOLLOW='<svg class="follow-icon" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="currentColor"/><path d="M12 6.5v11M6.5 12h11" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>';
export const escapeHtml=(t:string)=>t.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const scriptJson=(v:unknown)=>JSON.stringify(v).replaceAll('<','\\u003c');
const TEXT_COMPOSITIONS=new Set(['text_only','quote','contrast','minimal_pause','giant_statement']);
// lineSpace: extra px above given headline lines, opened by the ink map only where two lines collide.
export type ComposeOptions={lineSpace?:Record<number,number>;headlineCeiling?:number};
export function compose(c:CarouselData,a:ArtData,t:TweaksData,index:number,config:any,tokens:any,assetUrl?:string,frozen?:unknown,options:ComposeOptions={}){
 const s=c.slides[index],d=a.slides[s.id],tw=t.slides[s.id],p=tw?.params??{},comp=tw?.composition??d.composition;
 const fam=tokens.families[a.family],floors=tokens.floors,cover=index===0,last=index===c.slides.length-1,penultimate=index===c.slides.length-2;
 const headlineFloor=cover?floors.cover:floors.headline;
 const hsize=Math.max(headlineFloor,(cover?fam.cover.headlineSize:fam.headlineSize)+(p.headline_size_delta??0));
 const bsize=Math.max(floors.body,fam.bodySize+(p.body_size_delta??0));
 // The render loop may lower the ceiling when the filled headline's ink passes the safe area.
 const ceiling=Math.min(cover?fam.cover.ceiling:fam.headlineCeiling,options.headlineCeiling??Infinity);
 const maxLines=comp==='image_card'||comp==='cinematic_fade'?4:cover?5:6;
 const bodyLines=comp==='image_card'?6:comp==='cinematic_fade'?8:16;
 // Emphasis markers travel to the runtime, which draws them as <em> after line breaking.
 const headline=fam.uppercase?emphasis(s.headline).toLocaleUpperCase('pt-BR'):emphasis(s.headline);
 const hasImage=!!assetUrl||d.image.placeholder;
 const image=assetUrl?`<div class="image-slot"><img class="scene" alt="" src="${escapeHtml(assetUrl)}" style="object-position:${d.image.focal_point.x*100}% ${d.image.focal_point.y*100}%"></div>`
  :d.image.placeholder?`<div class="image-slot"><div class="scene placeholder"><span class="ph-label">Imagem pendente</span>${d.image.concept?`<span class="ph-concept">${escapeHtml(d.image.concept.slice(0,90))}</span>`:''}</div></div>`:'';
 const name=escapeHtml(config.branding.name),handle=escapeHtml(config.branding.handle);
 const avatar=config.branding.avatar?`<img alt="" src="/design/${escapeHtml(config.branding.avatar)}">`:'<span class="initials">DM</span>';
 const badge=`<div class="profile"><div class="ring">${avatar}</div><div class="identity"><div class="name">${name}${config.branding.verified?VERIFIED:''}</div><div class="handle">${handle}</div></div></div>`;
 // Covers have no footer bar (only an optional cue inside the copy), so their text may go lower than inner slides.
 const coverFooter=fam.cover.footer as 'none'|'cue';
 // Footer: handle pill + swipe cue; the penultimate panel invites to follow; the last has no cue; covers follow the family.
 const footer=cover?'':`<footer><span class="pill">${handle}</span>${last?'':penultimate?`<span class="cue follow">${FOLLOW}${escapeHtml(config.branding.follow_text)}</span>`:`<span class="cue">${escapeHtml(config.branding.swipe_text)}</span>`}</footer>`;
 const coverCue=cover&&coverFooter==='cue'?`<div class="cover-cue">${escapeHtml(config.branding.swipe_text)}</div>`:'';
 const classes=[a.family,comp,cover?'cover':'',TEXT_COMPOSITIONS.has(comp)?'text-composition':'',hasImage?'has-image':'no-image',`align-${cover?fam.cover.align:d.layout.align}`,`position-${d.layout.headline_position}`].filter(Boolean).join(' ');
 const vars={
  '--bg':fam.background,'--margin':`${fam.margin}px`,'--headline':tokens.colors.headline,'--body':fam.bodyColor,'--muted':tokens.colors.muted,'--handle':tokens.colors.handle,
  '--headline-font':`'${fam.headlineFont}'`,'--body-font':`'${fam.bodyFont}'`,'--headline-size':`${hsize}px`,'--body-size':`${bsize}px`,
  '--headline-lh':String(fam.headlineLineHeight),'--body-lh':String(fam.bodyLineHeight),
  '--headline-weight':String(cover?fam.cover.headlineWeight:fam.headlineWeight),'--body-weight':String(fam.bodyWeight),
  '--em-headline':fam.emphasis.headlineColor,'--em-body':fam.emphasis.bodyColor,'--em-weight':String(fam.emphasis.bodyWeight),
  '--gap':`${p.block_gap??fam.gap}px`,'--image-y':`${p.image_y??0}px`,'--image-scale':String(p.image_scale??1),
  '--image-top-h':`${fam.imageTop.height}px`,'--fade':`${fam.imageTop.fade}px`,'--card-top':`${fam.imageCard.top}px`,'--card-h':`${fam.imageCard.height}px`,'--card-r':`${fam.imageCard.radius}px`,
  '--pill-bg':tokens.colors.pill_bg,'--pill-border':tokens.colors.pill_border,'--follow':tokens.colors.follow,'--divider':tokens.colors.divider,'--placeholder':tokens.colors.placeholder,'--cue-size':`${tokens.footer.cue_size}px`,
 };
 const root=Object.entries(vars).map(([k,v])=>`${k}:${v}`).join(';');
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=1080"><title>P${index+1}</title><link rel="stylesheet" href="/design/fonts/fonts.css"><link rel="stylesheet" href="/design/base.css"><style>:root{${root}}</style></head>`
 // Covers without a footer may use the space the footer would take.
 +`<body class="${classes}" data-safe-bottom="${cover?1300:1230}"><main class="slide">${image}<div class="shade"></div>`
 +`${!cover&&config.branding.profile_on==='all'?`<div class="top-profile">${badge}</div>`:''}`
 +`<div class="copy-region"><div class="copy">${cover?`<div class="cover-profile">${badge}</div>`:''}${comp==='quote'?'<div class="quote-mark" aria-hidden="true">“</div>':''}`
 +`<h1 data-role="headline" data-floor="${headlineFloor}" data-ceiling="${ceiling}" data-max-lines="${maxLines}" data-fill="${d.fit.headline==='fill'&&(cover||comp==='giant_statement'||comp==='full_bleed')}">${escapeHtml(headline)}</h1>`
 +`${s.body?`<p data-role="body" data-floor="${floors.body}" data-max-lines="${bodyLines}">${escapeHtml(emphasis(s.body))}</p>`:''}${coverCue}</div></div>`
 +`${footer}</main><script>window.__frozenFit=${scriptJson(frozen??null)};window.__lineSpace=${scriptJson(options.lineSpace??{})}</script><script src="/design/runtime/linebreak.js"></script><script src="/design/runtime/slide.js"></script></body></html>`;
}
