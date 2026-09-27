/* Line breaking shared by the slide runtime (browser) and the unit tests (Node). No imports: it loads as a classic script.
   Finds the fewest lines first, then the best distribution among layouts with that count:
   ragged lines cost their squared slack, a line may not end on a short function word,
   the last line may not hold a single word (widow) or be much shorter than the rest.
   With balance (headlines), every line aims at the average width, so lines come out even. */
(function(){
  const SHORT=new Set('a o e de da do das dos em no na nos nas um uma que se pra por com ao à às os as ou'.split(' '));
  function breakParagraph(words,measure,width,options){
    const balance=!!(options&&options.balance),n=words.length;
    if(!n)return [''];
    // widths[i][j]: width of words i..j joined by spaces, stopping once past the width.
    const lineWidth=(i,j)=>measure(words.slice(i,j+1).join(' '));
    const fits=[];
    for(let i=0;i<n;i++){fits[i]=[];for(let j=i;j<n;j++){const w=lineWidth(i,j);fits[i].push(w);if(w>width)break;}}
    const W2=width*width;
    const total=measure(words.join(' '));
    // Balanced text aims every line at the average width for the line count; ragged text only pays slack before the last line.
    const cost=(i,j,last,target)=>{
      const used=fits[i][j-i];
      if(used>width)return j===i?W2*1e3+(used-width)*1e6:Infinity; // one word wider than the box: allowed, but reported by the fit.
      let c=balance?Math.pow(target-used,2):last?0:Math.pow(width-used,2);
      if(!last&&SHORT.has(words[j].toLowerCase()))c+=W2*2;
      if(last&&i===j&&i>0)c+=W2*3; // widow
      if(balance&&i===0&&j===0&&n>2)c+=W2*.5; // a lone first word in a title reads as a label
      // A sentence that ends inside a title line and leaves one word dangling after it ("QUE ATRAI. É") reads badly.
      if(balance)for(let k=i;k<j;k++)if(/[.!?:;]$/.test(words[k])&&j-k===1)c+=W2*4;
      if(last&&i>0&&used<width*.3)c+=Math.pow(width*.3-used,2)*4;
      return c;
    };
    // best[m][i]: cheapest way to set words i..n-1 in exactly m lines, every line priced against the same target.
    const solve=(k,target)=>{
      const best=[Array(n+1).fill(Infinity)],next=[[]];best[0][n]=0;
      for(let m=1;m<=k;m++){
        best[m]=Array(n+1).fill(Infinity);next[m]=[];
        for(let i=n-1;i>=0;i--){
          for(let j=i;j<n&&j-i<fits[i].length;j++){
            const rest=best[m-1][j+1];if(rest===Infinity)continue;
            const last=j===n-1;if(last!==(m===1))continue;
            const c=cost(i,j,last,target);if(c===Infinity)continue;
            if(c+rest<best[m][i]){best[m][i]=c+rest;next[m][i]=j+1;}
          }
        }
      }
      if(best[k][0]===Infinity)return null;
      const lines=[];for(let i=0,m=k;i<n;m--){const end=next[m][i];lines.push(words.slice(i,end).join(' '));i=end;}
      return lines;
    };
    // Feasibility does not depend on the target, so the first k that solves is the minimum line count.
    for(let k=1;k<=n;k++){const lines=solve(k,Math.min(width,total/k));if(lines)return lines;}
    return [words.join(' ')];
  }
  function breakText(text,measure,width,options){
    const lines=[];
    for(const paragraph of String(text).split('\n')){const words=paragraph.trim().split(/\s+/).filter(Boolean);lines.push(...(words.length?breakParagraph(words,measure,width,options):['']));}
    return lines;
  }
  globalThis.__breakText=breakText;
})();
