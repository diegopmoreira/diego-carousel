/* Fit runs only in the pinned Chromium. Each explicit line is persisted by the engine. */
window.__slideReady = false;
window.__fitError = null;
(async () => {
  const measure=document.createElement('canvas').getContext('2d');
  // Emphasized words may use another weight (body in Family B), so each segment is measured with its own font.
  const emWeight=el=>el.dataset.role==='body'?(getComputedStyle(el).getPropertyValue('--em-weight').trim()||getComputedStyle(el).fontWeight):getComputedStyle(el).fontWeight;
  function linesFor(text,el,size){
    const style=getComputedStyle(el),normal=`${style.fontWeight} ${size}px ${style.fontFamily}`,strong=`${emWeight(el)} ${size}px ${style.fontFamily}`;
    const width=t=>{let w=0,open=false;t.split('**').forEach((part,i)=>{if(i>0)open=!open;if(!part)return;measure.font=open?strong:normal;w+=measure.measureText(part).width;});return w;};
    return window.__breakText(text,width,el.clientWidth,{balance:el.dataset.role==='headline'});
  }
  // "**A B**" becomes "**A** **B**": every word carries its own markers, so any line can be measured and drawn alone.
  function perWordEmphasis(text){
    let open=false;
    return text.replace(/[^\s]+/g,word=>{let out='';word.split('**').forEach((part,i)=>{if(i>0)open=!open;if(part)out+=open?`**${part}**`:part;});return out;});
  }
  // **emphasis** may span lines; the open/closed state carries from one line to the next. Emphasis changes color only,
  // so the measured widths stay exact.
  function setLines(el,lines,size){
    el.style.fontSize=size+'px';let open=false;
    el.replaceChildren(...lines.map(t=>{
      const line=document.createElement('span');line.className='text-line';
      t.split('**').forEach((part,i)=>{if(i>0)open=!open;if(!part)return;if(open){const em=document.createElement('em');em.textContent=part;line.append(em);}else line.append(part);});
      if(!line.textContent)line.textContent='\u200b';
      return line;
    }));
  }
  const plain=t=>t.replace(/\*\*/g,'');
  // Lines are stored with their **markers**, so a frozen fit redraws the same emphasis.
  const linesOf=el=>[...el.children].map(line=>[...line.childNodes].map(n=>n.nodeName==='EM'?`**${n.textContent}**`:n.textContent.replace(/\u200b/g,'')).join(''));
  try {
    const blocks=[...document.querySelectorAll('[data-role="headline"],[data-role="body"]')];
    await Promise.all(blocks.flatMap(el=>{const s=getComputedStyle(el);return [s.fontWeight,emWeight(el)].map(w=>document.fonts.load(`${w} ${s.fontSize} ${s.fontFamily}`,el.textContent.replace(/\*\*/g,'')));}));
    await Promise.all([...document.images].map(im=>im.decode()));
    const frozen=window.__frozenFit;
    if(frozen){for(const el of blocks){const b=frozen.blocks[el.dataset.role];setLines(el,b.lines,b.size);}document.querySelector('.copy').style.gap=frozen.gap+'px';window.__fit=frozen;window.__slideReady=true;return;}
    const original=blocks.map(el=>perWordEmphasis(el.textContent));
    const floors=blocks.map(el=>Number(el.dataset.floor));
    const copy=document.querySelector('.copy');let gap=parseFloat(getComputedStyle(copy).gap);
    // The region's content box: padding (optical centering) is not room for text.
    const regionEl=document.querySelector('.copy-region');
    const region=()=>{const r=regionEl.getBoundingClientRect(),st=getComputedStyle(regionEl);return {height:r.height-parseFloat(st.paddingTop)-parseFloat(st.paddingBottom)};};
    const fits=()=>copy.getBoundingClientRect().height<=region().height+.5&&blocks.every(el=>el.scrollWidth<=el.clientWidth+1&&el.children.length<=Number(el.dataset.maxLines));
    const apply=(sizes,texts=original)=>blocks.forEach((el,i)=>setLines(el,linesFor(texts[i],el,sizes[i]),sizes[i]));
    // Stages record only what actually ran, in order.
    const stages=['line-break'];
    let sizes=blocks.map(el=>parseFloat(getComputedStyle(el).fontSize));apply(sizes);
    if(!fits()&&gap>24){gap=24;copy.style.gap='24px';stages.push('vertical-spacing');}
    if(!fits()){
      // Body shrinks first, the headline last; each block stops at its own floor.
      const order=blocks.map((el,i)=>i).sort((a,b)=>(blocks[a].dataset.role==='body'?0:1)-(blocks[b].dataset.role==='body'?0:1));
      for(const i of order){
        if(fits())break;
        stages.push(`font-floor:${blocks[i].dataset.role}`);
        while(!fits()&&sizes[i]>floors[i]){sizes[i]=Math.max(floors[i],sizes[i]-1);apply(sizes);}
      }
    } else if(blocks[0].dataset.fill==='true') {
      const max=Number(blocks[0].dataset.ceiling);let low=sizes[0],high=max;
      while(low<high){const mid=Math.ceil((low+high)/2);apply([mid,...sizes.slice(1)]);if(fits())low=mid;else high=mid-1;}
      if(low>sizes[0])stages.push('headline-fill');
      sizes[0]=low;apply(sizes);
    }
    const passed=fits(),overflow=Math.max(0,copy.getBoundingClientRect().height-region().height);
    // How much of each text fits at the final sizes: whole words, measured by the same layout.
    const charsThatFit=blocks.map((el,i)=>{
      if(passed)return plain(original[i]).length;
      const words=original[i].split(/(\s+)/);let low=0,high=words.length;
      while(low<high){const mid=Math.ceil((low+high)/2);const texts=[...original];texts[i]=words.slice(0,mid).join('');apply(sizes,texts);if(fits())low=mid;else high=mid-1;}
      apply(sizes);return plain(words.slice(0,low).join('')).trimEnd().length;
    });
    const needs=passed?[]:['alternative-composition','editorial-compression'];
    window.__fit={passed,gap,stages,needs,overflow_px:overflow,blocks:Object.fromEntries(blocks.map((el,i)=>[el.dataset.role,{size:parseFloat(getComputedStyle(el).fontSize),floor:floors[i],lines:linesOf(el),line_height:parseFloat(getComputedStyle(el).lineHeight),chars:plain(original[i]).length,chars_that_fit:charsThatFit[i]}]))};
    window.__slideReady=true;
  }catch(e){window.__fitError=String(e);window.__slideReady=true;}
})();
