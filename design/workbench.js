(() => {
 const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],form=$('#adjust-form');
 let data,index=0,dirty=false,working=false,file,grid=false,poll,initial={};
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
  const values={family:data.art.family,composition:data.tweaks.slides[s.id]?.composition??d.composition,align:d.layout.align,position:d.layout.headline_position,fit:d.fit.headline,headline_size_delta:t.headline_size_delta??0,body_size_delta:t.body_size_delta??0,block_gap:t.block_gap??44,image_scale:t.image_scale??1,focal_x:Math.round(d.image.focal_point.x*100),focal_y:Math.round(d.image.focal_point.y*100)};
  for(const [name,value]of Object.entries(values))field(name).value=value;
  field('asset_id').replaceChildren(new Option(d.image.need?'Sem imagem (pendente)':'Sem imagem',''),...data.assets.assets.map((a,i)=>new Option('Imagem '+(i+1)+' · '+a.rights.slice(0,30),a.id)));field('asset_id').value=d.image.asset_id??'';rangeLabels();
  // Snapshot of what the form shows; saving sends only the fields that differ from it.
  initial=Object.fromEntries([...Object.keys(values),'asset_id'].map(n=>[n,String(field(n).value)]));
  $('#copy-headline').textContent=s.headline;$('#copy-body').textContent=s.body??'Sem corpo de texto.';
  const fitSummary=$('#fit-summary');fitSummary.classList.toggle('error',!render?.passed||!data.render_current);
  fitSummary.textContent=!data.render_current?'Há alterações ainda não renderizadas. Atualiza antes de exportar.':!render?.passed?(render?.errors.join(' · ')??'Render pendente'):fit?'✓ Cabe no slide · título '+fit.blocks.headline.size+' px'+(fit.blocks.body?' · corpo '+fit.blocks.body.size+' px':''):'Aguardando render';
  if(grid)drawGrid();
 }
 function drawGrid(){$('#grid').replaceChildren(...data.carousel.slides.map((s,n)=>{const button=document.createElement('button'),im=document.createElement('img'),label=document.createElement('span');im.src=imageUrl(n);im.alt=s.headline;label.textContent='Slide '+(n+1);button.append(im,label);button.onclick=()=>{changeIndex(n);toggleGrid();};return button;}));}
 function toggleGrid(){grid=!grid;$('#stage').hidden=grid;$('#grid').hidden=!grid;$('#grid-toggle').setAttribute('aria-pressed',String(grid));$('#grid-toggle').textContent=grid?'Slide':'Grade';if(grid)drawGrid();}
 form.oninput=e=>{if(e.target.name==='headline_size_delta')field('fit').value='preferred';dirty=true;rangeLabels();$('#save').textContent='Salvar alterações';};
 const PARAMS=['headline_size_delta','body_size_delta','block_gap','image_scale'];
 function changes(){
  const changed=n=>String(field(n).value)!==initial[n],payload={id:data.carousel.slides[index].id},params={};
  for(const n of ['family','composition','align','position','fit'])if(changed(n))payload[n]=field(n).value;
  if(changed('asset_id'))payload.asset_id=field('asset_id').value||null;
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
 load().then(()=>{poll=setInterval(async()=>{if(working||document.hidden)return;try{const latest=await request('state');if(latest.busy)return;if(latest.revision!==data.revision||latest.manifest?.render_hash!==data.manifest?.render_hash||latest.render_current!==data.render_current){if(dirty){notice('O projeto mudou fora desta janela. Salva só depois de recarregar.',true);return;}data=latest;draw();}}catch{}},12000);}).catch(()=>{$('#offline-note').textContent='Preview estático. Para editar, abre este projeto com o comando preview.';});
})();
