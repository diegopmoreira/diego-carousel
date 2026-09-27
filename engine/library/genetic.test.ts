import { it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path'; import os from 'node:os';
import { loadEditorialLibrary, libraryStats } from './genetic.js';
const dirs:string[]=[];afterEach(async()=>{await Promise.all(dirs.splice(0).map(d=>rm(d,{recursive:true,force:true})));});
const slide=(n:number,body:string|null)=>`  - n: ${n}\n    role: ${n===1?'interruption':'mechanism'}\n    headline: "Headline sintética número ${n}"\n    body: ${body===null?'null':JSON.stringify(body)}\n`;
it('valida YAML da biblioteca e calcula as faixas de calibração',async()=>{
 const d=await mkdtemp(path.join(os.tmpdir(),'lib-'));dirs.push(d);await mkdir(path.join(d,'editorial'));process.env.CAROUSEL_LIBRARY_DIR=d;
 await writeFile(path.join(d,'editorial/ok.yaml'),`name: sintetico\npublished: teste\nfamily: editorial_clean\nthesis: "Tese sintética para teste"\narchitecture: base\nslides:\n${[1,2,3,4,5,6].map(n=>slide(n,n===1?null:'x'.repeat(100*n))).join('')}`);
 await writeFile(path.join(d,'editorial/ruim.yaml'),`name: Ruim\npublished: x\nfamily: outra\nthesis: curta\narchitecture: base\nslides: []\n`);
 const {examples,errors}=await loadEditorialLibrary();expect(examples).toHaveLength(1);expect(errors[0]).toMatch(/^ruim\.yaml/);
 const s=libraryStats(examples);expect(s.body_chars.n).toBe(5);expect(s.body_chars.median).toBe(400);expect(s.panels).toEqual({min:6,max:6});
});
