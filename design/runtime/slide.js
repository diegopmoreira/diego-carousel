/* Fit runs only in the pinned Chromium. Each explicit line is persisted by the engine. */
window.__slideReady = false;
window.__fitError = null;
(async () => {
  const measure=document.createElement('canvas').getContext('2d');
  function linesFor(text,el,size){
    const style=getComputedStyle(el);measure.font=`${style.fontWeight} ${size}px ${style.fontFamily}`;
    return window.__breakText(text,t=>measure.measureText(t).width,el.clientWidth,{balance:el.dataset.role==='headline'});
  }
  function setLines(el,lines,size){el.style.fontSize=size+'px';el.replaceChildren(...lines.map(t=>{const s=document.createElement('span');s.className='text-line';s.textContent=t||'​';return s;}));}
  try {
    const blocks=[...document.querySelectorAll('[data-role="headline"],[data-role="body"]')];
    await Promise.all(blocks.map(el=>{const s=getComputedStyle(el);return document.fonts.load(`${s.fontWeight} ${s.fontSize} ${s.fontFamily}`,el.textContent);}));
    await Promise.all([...document.images].map(im=>im.decode()));
    const frozen=window.__frozenFit;
    if(frozen){for(const el of blocks){const b=frozen.blocks[el.dataset.role];setLines(el,b.lines,b.size);}document.querySelector('.copy').style.gap=frozen.gap+'px';window.__fit=frozen;window.__slideReady=true;return;}
    const original=blocks.map(el=>el.textContent);
    const floors=blocks.map(el=>Number(el.dataset.floor));
    const copy=document.querySelector('.copy');let gap=parseFloat(getComputedStyle(copy).gap);
    const region=()=>document.querySelector('.copy-region').getBoundingClientRect();
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
      if(passed)return original[i].length;
      const words=original[i].split(/(\s+)/);let low=0,high=words.length;
      while(low<high){const mid=Math.ceil((low+high)/2);const texts=[...original];texts[i]=words.slice(0,mid).join('');apply(sizes,texts);if(fits())low=mid;else high=mid-1;}
      apply(sizes);return words.slice(0,low).join('').trimEnd().length;
    });
    const needs=passed?[]:['alternative-composition','editorial-compression'];
    window.__fit={passed,gap,stages,needs,overflow_px:overflow,blocks:Object.fromEntries(blocks.map((el,i)=>[el.dataset.role,{size:parseFloat(getComputedStyle(el).fontSize),floor:floors[i],lines:[...el.children].map(s=>s.textContent),line_height:parseFloat(getComputedStyle(el).lineHeight),chars:original[i].length,chars_that_fit:charsThatFit[i]}]))};
    window.__slideReady=true;
  }catch(e){window.__fitError=String(e);window.__slideReady=true;}
})();
