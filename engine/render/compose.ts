import type { CarouselData, ArtData, TweaksData } from '../schema/index.js';
import { plainText } from '../source/copy.js';
export const escapeHtml=(t:string)=>t.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const scriptJson=(v:unknown)=>JSON.stringify(v).replaceAll('<','\\u003c');
export function compose(c:CarouselData,a:ArtData,t:TweaksData,index:number,config:any,tokens:any,assetUrl?:string,frozen?:unknown){
 const s=c.slides[index],d=a.slides[s.id],tw=t.slides[s.id],p=tw?.params??{},comp=tw?.composition??d.composition;
 const family=tokens.families[a.family],cover=index===0;
 const hsize=Math.max(cover?58:52,family.headlineSize+(p.headline_size_delta??0));const bsize=Math.max(36,family.bodySize+(p.body_size_delta??0));
 const headline=family.uppercase?plainText(s.headline).toLocaleUpperCase('pt-BR'):plainText(s.headline);
 const image=assetUrl?`<div class="image-slot"><img class="scene" alt="" src="${escapeHtml(assetUrl)}" style="object-position:${d.image.focal_point.x*100}% ${d.image.focal_point.y*100}%"></div>`:d.image.placeholder?'<div class="image-slot"><div class="scene placeholder"><span>IMAGEM PENDENTE</span></div></div>':'';
 const name=escapeHtml(config.branding.name),handle=escapeHtml(config.branding.handle);
 const avatar=config.branding.avatar?`<img alt="" src="/design/${escapeHtml(config.branding.avatar)}">`:'<span class="initials">DM</span>';
 const badge=`<div class="profile"><div class="ring">${avatar}</div><div><div class="name">${name}${config.branding.verified?'<span class="verified">✓</span>':''}</div><div class="handle">${handle}</div></div></div>`;
 const cue=index===c.slides.length-1?'':index===c.slides.length-2?config.branding.follow_text:config.branding.swipe_text;
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=1080"><title>P${index+1}</title><link rel="stylesheet" href="/design/fonts/fonts.css"><link rel="stylesheet" href="/design/base.css"><style>
 :root{--background:${tokens.colors.background};--headline:${tokens.colors.headline};--body:${a.family==='cinematic_condensed'?'#E3E3E3':tokens.colors.body};--headline-font:'${family.headlineFont}';--body-font:'${family.bodyFont}';--headline-size:${hsize}px;--body-size:${bsize}px;--headline-lh:${family.headlineLineHeight};--body-lh:${family.bodyLineHeight};--gap:${p.block_gap??44}px;--image-y:${p.image_y??0}px;--image-scale:${p.image_scale??1};--headline-weight:${a.family==='cinematic_condensed'?400:800};--body-weight:${a.family==='cinematic_condensed'?500:400};}
 </style></head><body class="${a.family} ${comp} ${cover?'cover':''} align-${d.layout.align} position-${d.layout.headline_position}"><main class="slide">${image}<div class="fade"></div><div class="top-profile">${badge}</div><div class="copy-region"><div class="copy">${cover?`<div class="cover-profile">${badge}</div>`:''}<h1 data-role="headline" data-floor="${cover?58:52}" data-ceiling="${a.family==='cinematic_condensed'?120:96}" data-max-lines="${comp==='image_card'?4:cover?6:7}" data-fill="${d.fit.headline==='fill'}">${escapeHtml(headline)}</h1>${s.body?`<p data-role="body" data-floor="36" data-max-lines="${comp==='image_card'?6:18}">${escapeHtml(plainText(s.body))}</p>`:''}</div></div><footer><span class="pill">${handle}</span><span class="cue">${escapeHtml(cue)}</span><span class="page-number">${String(index+1).padStart(2,'0')}</span></footer></main><script>window.__frozenFit=${scriptJson(frozen??null)}</script><script src="/design/runtime/slide.js"></script></body></html>`;
}
