/* Fit runs only in the pinned Chromium. Each explicit line is persisted by the engine. */
window.__slideReady = false;
window.__fitError = null;
(async () => {
  const measure=document.createElement('canvas').getContext('2d');
  const short=new Set('a o e de da do em no na um uma que se não pra por com ao à'.split(' '));
  function linesFor(text,el,size) {
    const style=getComputedStyle(el);measure.font=`${style.fontWeight} ${size}px ${style.fontFamily}`;
    const width=el.clientWidth;
    const all=[];
    for(const paragraph of text.split('\n')){
      const words=paragraph.trim().split(/\s+/).filter(Boolean);
      if(!words.length){all.push('');continue;}
      const n=words.length, costs=Array(n+1).fill(Infinity), ends=Array(n).fill(0);costs[n]=0;
      for(let i=n-1;i>=0;i--){
        let line='';
        for(let j=i;j<n;j++){
          line+=(j===i?'':' ')+words[j]; const used=measure.measureText(line).width;
          if(used>width&&j>i)break;
          const overflow=Math.max(0,used-width);
          const penalty=(j===n-1?0:Math.pow(width-used,2))+(short.has(words[j].toLowerCase())&&j<n-1?width*40:0)+overflow*1e6;
          if(penalty+costs[j+1]<costs[i]){costs[i]=penalty+costs[j+1];ends[i]=j+1;}
        }
      }
      for(let i=0;i<n;){const end=ends[i]||i+1;all.push(words.slice(i,end).join(' '));i=end;}
    }
    return all;
  }
  function setLines(el,lines,size){el.style.fontSize=size+'px';el.replaceChildren(...lines.map(t=>{const s=document.createElement('span');s.className='text-line';s.textContent=t||'\u200b';return s;}));}
  try {
    const blocks=[...document.querySelectorAll('[data-role="headline"],[data-role="body"]')];
    await Promise.all(blocks.map(el=>{const s=getComputedStyle(el);return document.fonts.load(`${s.fontWeight} ${s.fontSize} ${s.fontFamily}`,el.textContent);}));
    await Promise.all([...document.images].map(im=>im.decode()));
    const frozen=window.__frozenFit;
    if(frozen){for(const el of blocks){const b=frozen.blocks[el.dataset.role];setLines(el,b.lines,b.size);}document.querySelector('.copy').style.gap=frozen.gap+'px';window.__fit=frozen;window.__slideReady=true;return;}
    const original=blocks.map(el=>el.textContent);
    const start=blocks.map(el=>parseFloat(getComputedStyle(el).fontSize));
    const floors=blocks.map(el=>Number(el.dataset.floor));
    const copy=document.querySelector('.copy');let gap=parseFloat(getComputedStyle(copy).gap);
    const stages=['line-break'];
    const fits=()=>{
      const region=document.querySelector('.copy-region').getBoundingClientRect();const rect=copy.getBoundingClientRect();
      return rect.height<=region.height+.5&&blocks.every(el=>el.scrollWidth<=el.clientWidth+1&&el.children.length<=Number(el.dataset.maxLines));
    };
    const apply=(sizes)=>blocks.forEach((el,i)=>setLines(el,linesFor(original[i],el,sizes[i]),sizes[i]));
    let sizes=[...start];apply(sizes);
    if(!fits()){gap=24;copy.style.gap='24px';stages.push('vertical-spacing');}
    if(!fits()){
      stages.push('alternative-composition-required','editorial-compression-requires-agent','font-floor');
      while(!fits()&&sizes.some((s,i)=>s>floors[i])){sizes=sizes.map((s,i)=>Math.max(floors[i],s-1));apply(sizes);}
    } else if(blocks[0].dataset.fill==='true') {
      const max=Number(blocks[0].dataset.ceiling);let low=sizes[0],high=max;
      while(low<high){const mid=Math.ceil((low+high)/2);apply([mid,...sizes.slice(1)]);if(fits())low=mid;else high=mid-1;}
      sizes[0]=low;apply(sizes);
    }
    const region=document.querySelector('.copy-region').getBoundingClientRect();
    window.__fit={passed:fits(),gap,stages,overflow_px:Math.max(0,copy.getBoundingClientRect().height-region.height),blocks:Object.fromEntries(blocks.map(el=>[el.dataset.role,{size:parseFloat(getComputedStyle(el).fontSize),lines:[...el.children].map(s=>s.textContent),line_height:parseFloat(getComputedStyle(el).lineHeight),chars_that_fit:fits()?el.textContent.length:null}]))};
    window.__slideReady=true;
  }catch(e){window.__fitError=String(e);window.__slideReady=true;}
})();
