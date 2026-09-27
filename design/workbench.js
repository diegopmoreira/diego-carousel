(() => {
 const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],form=$('#adjust-form');
 let data,index=0,dirty=false,working=false,file,grid=false,poll,initial={},view='slide',events;
 const search=new URLSearchParams(location.search),variant=search.get('variant'),project=search.get('project');
 const endpoint=p=>{const q=new URLSearchParams();if(project)q.set('project',project);if(variant)q.set('variant',variant);return p+(q.size?'?'+q:'');};
 const navigateVariant=v=>{const q=new URLSearchParams();if(project)q.set('project',project);if(v)q.set('variant',v);location.search=q.toString();};
 const imageUrl=(n)=>endpoint('/project/qa/render/'+String(n+1).padStart(2,'0')+'.png')+(variant||project?'&':'?')+'v='+(data.manifest?.slides.find(s=>s.id===data.carousel.slides[n].id)?.png_hash??Date.now());
 function notice(message,error=false){const el=$('#notice');el.textContent=message;el.hidden=false;el.classList.toggle('error',error);clearTimeout(notice.timer);if(!error)notice.timer=setTimeout(()=>el.hidden=true,5000);}
 function busy(on){working=on;document.body.classList.toggle('working',on);$$('button,select,input,textarea').forEach(el=>el.disabled=on);$('#save').textContent=on?'Atualizando…':'Salvar e atualizar slide';if(!on&&data)$('#export').disabled=!(data.render_current&&data.manifest?.slides.every(s=>s.passed));}
 async function request(url,payload){const r=await fetch(endpoint('/api/'+url),payload?{method:'POST',headers:{'Content-Type':'application/json','X-Carousel-Token':data.token},body:JSON.stringify({revision:data.revision,...payload})}:{});const result=await r.json();if(!r.ok)throw Error(result.error??'Falha na atualização');return result;}
 async function load(){data=await request('state');if(data.empty){drawEmpty();return;}index=Math.min(index,data.carousel.slides.length-1);draw();}
 function drawEmpty(){$('#studio').hidden=false;$('#fallback').hidden=true;$('#project-select').replaceChildren(new Option('Nenhum carrossel ainda',''));$('#status').textContent='Sem projeto';['#refresh','#new-version','#export','#grid-toggle','#save','#upload-button'].forEach(s=>$(s).disabled=true);$('#create-dialog').showModal();}
 async function action(name,payload={}){busy(true);try{const result=await request(name,payload);if(result.revision){data=result;dirty=false;draw();}return result;}catch(e){notice(e.message,true);try{data=await request('state');dirty=false;draw();}catch{}throw e;}finally{busy(false);}}
 function field(name){return form.elements.namedItem(name);}
 function changeIndex(n){if(dirty&&!confirm('Descartar os ajustes ainda não salvos?'))return;index=(n+data.carousel.slides.length)%data.carousel.slides.length;dirty=false;draw();}
 function rangeLabels(){$$('output[data-for]').forEach(el=>{const name=el.dataset.for,value=Number(field(name).value);el.textContent=name==='image_scale'?value.toFixed(2)+'×':name.startsWith('focal_')?value+'%':(name.endsWith('_delta')&&value>0?'+':'')+value+' px';});}
 function draw(){
  if(!data.carousel.slides.length){notice('Este projeto ainda não possui slides. Importa a copy antes de abrir o estúdio.',true);return;}
  $('#studio').hidden=false;$('#fallback').hidden=true;$('#title').textContent=data.title.replaceAll('-',' ');$('#count').textContent=data.carousel.slides.length;
  const projects=data.projects??[];$('#project-select').replaceChildren(...[...new Set([data.project_name,...projects])].map(p=>new Option(p===data.project_name?data.title.replaceAll('-',' '):p.replace(/^\d{4}-\d{2}-\d{2}-/,'').replaceAll('-',' '),p)));$('#project-select').value=data.project_name;
  const editorialErrors=data.lint?.issues?.filter(i=>i.severity==='error')??[];if(editorialErrors.length)notice(editorialErrors.map(i=>i.message).join(' · '),true);
  const passed=data.render_current&&data.manifest?.slides.every(s=>s.passed);
  $('#status').textContent=passed?(data.review_current?'Revisado':'Pronto para revisar'):'Precisa atualizar';$('#status').classList.toggle('pending',!passed);
  $('#export').disabled=!passed;$('#promote').hidden=!variant;
  $('#version').replaceChildren(new Option('Principal',''),...data.variants.map(v=>new Option(v,v)));$('#version').value=variant??'';
  const s=data.carousel.slides[index],d=data.art.slides[s.id],t=data.tweaks.slides[s.id]?.params??{},render=data.manifest?.slides.find(r=>r.id===s.id),fit=data.fits[s.id];
  $('#slides').replaceChildren(...data.carousel.slides.map((s,n)=>{const button=document.createElement('button');button.className='thumb';button.setAttribute('aria-current',String(n===index));const im=document.createElement('img');im.src=imageUrl(n);im.alt='';im.loading='lazy';const text=document.createElement('span'),title=document.createElement('strong'),sub=document.createElement('small');title.textContent=String(n+1).padStart(2,'0')+(n===0?' · Capa':'');sub.textContent=s.headline;const r=data.manifest?.slides.find(r=>r.id===s.id);if(r&&!r.passed){sub.textContent='Ajustar texto';sub.className='failed';}text.append(title,sub);button.append(im,text);button.onclick=()=>changeIndex(n);return button;}));
  $('#canvas').src=imageUrl(index);$('#canvas').alt='Slide '+(index+1)+': '+s.headline;$('#canvas').onerror=()=>{$('#missing').hidden=false;};$('#canvas').onload=()=>{$('#missing').hidden=true;};$('#slide-label').textContent=String(index+1).padStart(2,'0')+' / '+String(data.carousel.slides.length).padStart(2,'0');$('#inspector-title').textContent=index===0?'Capa':'Slide '+String(index+1).padStart(2,'0');
  const values={family:data.art.family,composition:data.tweaks.slides[s.id]?.composition??d.composition,align:d.layout.align,position:d.layout.headline_position,fit:d.fit.headline,headline_size_delta:t.headline_size_delta??0,body_size_delta:t.body_size_delta??0,block_gap:t.block_gap??data.family_gaps?.[data.art.family]??22,image_scale:t.image_scale??1,focal_x:Math.round(d.image.focal_point.x*100),focal_y:Math.round(d.image.focal_point.y*100)};
  for(const [name,value]of Object.entries(values))field(name).value=value;
  // Current image first, then this slide's alternatives, then the rest of the library.
  const alternatives=new Set(d.image.alternatives??[]),rank=a=>a.id===d.image.asset_id?0:alternatives.has(a.id)?1:2,label=a=>(rank(a)===0?'Atual':rank(a)===1?'Alternativa':'Biblioteca')+' · '+(a.origin==='generated'?'gerada':'enviada')+(a.score!==undefined?' · nota '+a.score:'')+' · '+a.id.slice(-4);
  field('asset_id').replaceChildren(new Option(d.image.need?'Sem imagem (pendente)':'Sem imagem',''),...[...data.assets.assets].sort((a,b)=>rank(a)-rank(b)).map(a=>new Option(label(a),a.id)));field('asset_id').value=d.image.asset_id??'';rangeLabels();
  // Snapshot of what the form shows; saving sends only the fields that differ from it.
  field('image_need').checked=!!d.image.need;
  initial=Object.fromEntries([...Object.keys(values),'asset_id'].map(n=>[n,String(field(n).value)]));
  initial.image_need=String(field('image_need').checked);
  $('#copy-headline').textContent=s.headline;$('#copy-body').textContent=s.body??'Sem corpo de texto.';
  const fitSummary=$('#fit-summary');fitSummary.classList.toggle('error',!render?.passed||!data.render_current);
  fitSummary.textContent=!data.render_current?'Há alterações ainda não renderizadas. Atualiza antes de exportar.':!render?.passed?(render?.errors.join(' · ')??'Render pendente'):fit?'✓ Cabe no slide · título '+fit.blocks.headline.size+' px'+(fit.blocks.body?' · corpo '+fit.blocks.body.size+' px':'')+(render.warnings?.length?' · ⚠ '+render.warnings.join(' · '):''):'Aguardando render';
  hideLive();if(view==='instagram')drawInstagram();
  const pending=data.pending??[];$('#pending').hidden=!pending.length;if(pending.length)$('#pending-text').textContent=pending.map(p=>p.type==='voice'?'Proposta de voz (você → tu) aguardando tua aprovação':'Proposta de edição da copy aguardando tua aprovação').join(' · ');
  if(grid)drawGrid();
 }
 // Live preview: the frozen slide HTML in an iframe, with the inspector values applied as they change.
 // Line breaks stay frozen, so it is an approximation; saving runs the real fit and render.
 const LIVE=['headline_size_delta','body_size_delta','block_gap','image_scale','focal_x','focal_y','align','position'];
 const htmlUrl=n=>endpoint('/project/html/slide-'+String(n+1).padStart(2,'0')+'.html');
 function scaleLive(){const frame=$('#live-frame'),box=$('#frame');frame.style.transform='scale('+(box.clientWidth/1080)+')';}
 function hideLive(){$('#live').hidden=true;}
 function applyLive(){
  const doc=$('#live-frame').contentDocument;if(!doc||!doc.querySelector('.slide')||!$('#live-frame').contentWindow.__slideReady)return;
  const s=data.carousel.slides[index],fit=data.fits[s.id],t=data.tweaks.slides[s.id]?.params??{};
  const h1=doc.querySelector('h1'),p=doc.querySelector('p[data-role="body"]'),num=n=>Number(field(n).value);
  if(h1&&fit)h1.style.fontSize=Math.max(Number(h1.dataset.floor),fit.blocks.headline.size+num('headline_size_delta')-(t.headline_size_delta??0))+'px';
  if(p&&fit?.blocks.body)p.style.fontSize=Math.max(36,fit.blocks.body.size+num('body_size_delta')-(t.body_size_delta??0))+'px';
  const copy=doc.querySelector('.copy');if(copy)copy.style.gap=num('block_gap')+'px';
  doc.documentElement.style.setProperty('--image-scale',String(num('image_scale')));
  const img=doc.querySelector('img.scene');if(img)img.style.objectPosition=num('focal_x')+'% '+num('focal_y')+'%';
  const body=doc.body;body.classList.remove('align-left','align-center','position-top','position-center','position-bottom');body.classList.add('align-'+field('align').value,'position-'+field('position').value);
 }
 function showLive(){
  const frame=$('#live-frame'),url=htmlUrl(index);$('#live').hidden=false;scaleLive();
  // The slide runtime sets the frozen sizes after fonts and images load: apply only once it reports ready.
  const whenReady=()=>{const w=frame.contentWindow;if(w&&w.__slideReady){scaleLive();applyLive();}else setTimeout(whenReady,50);};
  if(frame.dataset.src!==url){frame.dataset.src=url;frame.onload=whenReady;frame.src=url;}else whenReady();
 }
 new ResizeObserver(()=>{if(!$('#live').hidden)scaleLive();}).observe($('#frame'));
 $('#safe-area').onchange=e=>{$('#safe-overlay').hidden=!e.target.checked;};
 // Instagram: the exported PNGs as a feed post, with the caption.
 let igIndex=0;
 function drawInstagram(){
  const n=data.carousel.slides.length;igIndex=Math.min(igIndex,n-1);
  $$('.ig-handle').forEach(el=>el.textContent=(data.handle??'odiego.moreira').replace(/^@/,''));
  $('#ig-image').src=imageUrl(igIndex);$('#ig-grid-image').src=imageUrl(0);$('.ig-count').textContent=(igIndex+1)+'/'+n;
  $('.ig-dots').replaceChildren(...Array.from({length:n},(_,i)=>{const d=document.createElement('i');if(i===igIndex)d.className='on';return d;}));
  $('#ig-caption-text').textContent=data.carousel.editorial.caption||data.carousel.slides[0].headline;
  $('.ig-prev').hidden=igIndex===0;$('.ig-next').hidden=igIndex===n-1;
 }
 $('.ig-prev').onclick=()=>{igIndex--;drawInstagram();};$('.ig-next').onclick=()=>{igIndex++;drawInstagram();};
 function setView(v){view=v;$$('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===v)));$('#frame').hidden=v!=='slide';$('#instagram').hidden=v!=='instagram';if(v==='instagram'){igIndex=index;drawInstagram();}}
 $$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
 $('#pending-open').onclick=()=>{const p=(data.pending??[])[0];if(!p)return;$('#approve-title').textContent=p.type==='voice'?'Voz: você → tu':'Edição da copy';$('#approve-text').textContent=p.markdown;$('#approve-form').dataset.type=p.type;$('#approve-form').dataset.hash=p.hash;try{$('#approve-form').elements.by.value||=localStorage.getItem('carousel-reviewer')??'';}catch{}$('#approve-dialog').showModal();};
 $('#approve-form').onsubmit=async e=>{e.preventDefault();const f=e.target;$('#approve-dialog').close();try{await action('approve',{type:f.dataset.type,hash:f.dataset.hash,by:f.elements.by.value.trim(),confirmed:f.elements.confirmed.checked});notice('Aprovado e aplicado. Slides atualizados.');}catch{}};
 function drawGrid(){$('#grid').replaceChildren(...data.carousel.slides.map((s,n)=>{const button=document.createElement('button'),im=document.createElement('img'),label=document.createElement('span');im.src=imageUrl(n);im.alt=s.headline;label.textContent='Slide '+(n+1);button.append(im,label);button.onclick=()=>{changeIndex(n);toggleGrid();};return button;}));}
 function toggleGrid(){grid=!grid;$('#stage').hidden=grid;$('#grid').hidden=!grid;$('#grid-toggle').setAttribute('aria-pressed',String(grid));$('#grid-toggle').textContent=grid?'Slide':'Grade';if(grid)drawGrid();}
 // A composition brings its usual text position and headline fit; a text layout takes the image out of the slide (the
 // server keeps it as an alternative) and an image slot without an image waits for one ("Exige imagem").
 function compositionDefaults(comp){
  const image=(data.image_compositions??[]).includes(comp);
  field('position').value=index===0||comp==='image_card'?'bottom':image?'top':'center';field('fit').value=index===0||comp==='giant_statement'?'fill':'preferred';
  if(!image&&(field('asset_id').value||field('image_need').checked)){field('asset_id').value='';field('image_need').checked=false;notice('Composição sem imagem: a imagem sai deste slide e fica como alternativa.');}
  if(image&&comp!=='full_bleed'&&!field('asset_id').value)field('image_need').checked=true;
 }
 form.onchange=e=>{if(e.target.name==='composition')compositionDefaults(e.target.value);if(LIVE.includes(e.target.name)&&view==='slide'&&data.fits[data.carousel.slides[index].id])showLive();};
 form.oninput=e=>{if(e.target.name==='headline_size_delta')field('fit').value='preferred';dirty=true;rangeLabels();$('#save').textContent='Salvar alterações';if(LIVE.includes(e.target.name)&&view==='slide'&&data.fits[data.carousel.slides[index].id])showLive();};
 const PARAMS=['headline_size_delta','body_size_delta','block_gap','image_scale'];
 function changes(){
  const changed=n=>String(field(n).value)!==initial[n],payload={id:data.carousel.slides[index].id},params={};
  for(const n of ['family','composition','align','position','fit'])if(changed(n))payload[n]=field(n).value;
  if(changed('asset_id'))payload.asset_id=field('asset_id').value||null;
  if(String(field('image_need').checked)!==initial.image_need)payload.image_need=field('image_need').checked;
  for(const n of ['focal_x','focal_y'])if(changed(n))payload[n]=Number(field(n).value)/100;
  for(const n of PARAMS)if(changed(n))params[n]=Number(field(n).value);
  if(Object.keys(params).length)payload.params=params;
  return payload;
 }
 form.onsubmit=async e=>{e.preventDefault();const payload=changes();if(Object.keys(payload).length===1){dirty=false;notice('Nada mudou neste slide.');return;}try{await action('adjust',payload);notice('Ajustes salvos. Preview atualizado.');}catch{}};
 $('#previous').onclick=()=>changeIndex(index-1);$('#next').onclick=()=>changeIndex(index+1);$('#grid-toggle').onclick=toggleGrid;
 document.addEventListener('keydown',e=>{if(working||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||$$('dialog[open]').length)return;if(e.key==='ArrowRight')changeIndex(index+1);if(e.key==='ArrowLeft')changeIndex(index-1);});
 $('#refresh').onclick=async()=>{if(dirty&&!confirm('Descartar os ajustes ainda não salvos?'))return;try{await action('render');notice('Carrossel atualizado.');}catch{}};
 $('#new-project').onclick=()=>{if(dirty){notice('Salva os ajustes antes de criar outro carrossel.',true);return;}$('#create-dialog').showModal();};
 $('#create-form').onsubmit=async e=>{e.preventDefault();const f=e.target;$('#create-dialog').close();try{const result=await action('create',{slug:f.elements.slug.value,copy:f.elements.copy.value,family:f.elements.family.value});location.href='/?project='+encodeURIComponent(result.project);}catch{}};
 $('#new-version').onclick=()=>{if(dirty){notice('Salva os ajustes antes de criar outra versão.',true);return;}$('#variant-dialog').showModal();};
 $('#variant-form').onsubmit=async e=>{e.preventDefault();const f=e.target;$('#variant-dialog').close();try{const result=await action('variant',{name:f.elements.name.value,family:f.elements.family.value});navigateVariant(result.variant);}catch{}};
 $('#project-select').onchange=e=>{if(dirty&&!confirm('Descartar ajustes não salvos?')){e.target.value=data.project_name;return;}location.href='/?project='+encodeURIComponent(e.target.value);};
 $('#version').onchange=e=>{if(dirty&&!confirm('Descartar ajustes não salvos?')){e.target.value=variant??'';return;}navigateVariant(e.target.value);};
 $('#promote').onclick=async()=>{if(dirty){notice('Salva os ajustes antes de usar esta versão.',true);return;}if(!confirm('Usar esta versão como principal? O visual anterior será guardado.'))return;try{await action('promote');navigateVariant(null);}catch{}};
 $('#export').onclick=()=>{if(dirty){notice('Salva os ajustes antes de exportar.',true);return;}try{$('#export-form').elements.reviewer.value||=localStorage.getItem('carousel-reviewer')??'';}catch{}$('#export-dialog').showModal();};
 $('#export-form').onsubmit=async e=>{e.preventDefault();const f=e.target;$('#export-dialog').close();const reviewer=f.elements.reviewer.value.trim();try{localStorage.setItem('carousel-reviewer',reviewer);}catch{}try{await action('export',{confirmed:f.elements.confirmed.checked,reviewer,note:f.elements.note.value});const link=document.createElement('a');const q=new URLSearchParams(endpoint('').slice(1));q.set('token',data.token);link.href='/api/download?'+q;link.download='carrossel.zip';document.body.append(link);link.click();link.remove();notice('PNG exportados. Download iniciado.');}catch{}};
 $$('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
 $('#upload-button').onclick=()=>{if(dirty){notice('Salva os ajustes antes de adicionar uma imagem.',true);return;}$('#upload-file').click();};
 $('#upload-file').onchange=e=>{file=e.target.files[0];if(!file)return;if(file.size>20*1024*1024){notice('Usa uma imagem de até 20 MB.',true);return;}$('#upload-name').textContent=file.name;$('#upload-dialog').showModal();};
 $('#upload-form').onsubmit=async e=>{e.preventDefault();const rights=e.target.elements.rights.value;$('#upload-dialog').close();const reader=new FileReader();reader.onload=async()=>{try{const result=await action('asset',{id:data.carousel.slides[index].id,rights,data:String(reader.result).split(',')[1]});if(result.warning)notice(result.warning,true);else notice('Imagem adicionada ao slide.');}catch{}};reader.readAsDataURL(file);};
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
 // Changes made elsewhere (CLI, Claude, another window) arrive as server events; polling is only the fallback.
 async function refresh(){if(working)return;try{const latest=await request('state');if(latest.busy)return;const pendingKey=d=>JSON.stringify((d.pending??[]).map(p=>[p.type,p.hash]));if(latest.revision!==data.revision||latest.manifest?.render_hash!==data.manifest?.render_hash||latest.render_current!==data.render_current||latest.review_current!==data.review_current||pendingKey(latest)!==pendingKey(data)){if(dirty){notice('O projeto mudou fora desta janela. Salva só depois de recarregar.',true);return;}data=latest;draw();}}catch{}}
 function listen(){
  if(!window.EventSource||data.empty){poll=setInterval(()=>{if(!document.hidden)refresh();},12000);return;}
  const q=new URLSearchParams(endpoint('').slice(1));q.set('token',data.token);
  events=new EventSource('/api/events?'+q);events.addEventListener('change',()=>refresh());
  // EventSource reconnects by itself; polling covers the time it stays closed.
  events.onerror=()=>{if(events.readyState===EventSource.CLOSED&&!poll)poll=setInterval(()=>{if(!document.hidden)refresh();},12000);};
 }
 load().then(listen).catch(()=>{$('#offline-note').textContent='Preview estático. Para editar, abre este projeto com o comando preview.';});
})();
