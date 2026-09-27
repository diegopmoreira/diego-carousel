// Acceptance fixtures of the spec (§94), run end to end. Modes:
//   npm run eval -- --dry-run            sources available? what would run
//   npm run eval -- --engine-only        design-only fixtures through the engine alone (no Claude)
//   npm run eval [-- --only 1,3]         full run: each fixture through `claude -p` with the diego-carousel skill
// Runs in a temporary projects folder; the report goes to eval/report-<timestamp>.{md,json} (not versioned).
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { access, mkdtemp, mkdir, readdir, writeFile, readFile, rm } from 'node:fs/promises';
import { ROOT, readJson, writeJson } from '../engine/project/io.js';
const args=process.argv.slice(2),flag=(n:string)=>{const i=args.indexOf('--'+n);return i<0?undefined:args[i+1];};
const dry=args.includes('--dry-run'),engineOnly=args.includes('--engine-only'),only=flag('only')?.split(',').map(Number);
type Fixture={id:number;name:string;mode:'full'|'design-only';source:string;expect:Record<string,unknown>;note:string};
const {fixtures}=await readJson(path.join(ROOT,'fixtures/eval.json')) as {fixtures:Fixture[]};
const expand=(s:string)=>s.startsWith('~/')?path.join(os.homedir(),s.slice(2)):s.startsWith('corpus:')?s:path.resolve(ROOT,s);
async function available(f:Fixture){
 if(f.source.includes('ESCOLHER'))return 'escolher o vídeo no Corpus e editar fixtures/eval.json';
 if(f.source.startsWith('corpus:')){const dir=process.env.CAROUSEL_CORPUS_DIR||path.join(os.homedir(),'Library/Application Support/CorpusDiego/data');try{await access(path.join(dir,'transcricoes',f.source.slice(7),'v1.json'));return null;}catch{return `transcrição ${f.source} não encontrada em ${dir}`;}}
 try{await access(expand(f.source));return null;}catch{return `arquivo ausente: ${expand(f.source)}`;}
}
const work=await mkdtemp(path.join(os.tmpdir(),'carousel-eval-')),projects=path.join(work,'projects');await mkdir(projects,{recursive:true});
// Autonomous run: no checkpoint after the thesis.
const config=await readJson(path.join(ROOT,'config.json'));config.editorial.checkpoint_after_thesis=false;await writeJson(path.join(work,'config.json'),config);
const env={...process.env,CAROUSEL_PROJECTS_DIR:projects,CAROUSEL_CONFIG:path.join(work,'config.json')};
function run(cmd:string,argv:string[],timeout:number){return new Promise<{code:number|null;out:string}>(resolve=>{const p=spawn(cmd,argv,{cwd:ROOT,env,stdio:['ignore','pipe','pipe']});let out='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>out+=d);const t=setTimeout(()=>p.kill('SIGTERM'),timeout);p.on('close',code=>{clearTimeout(t);resolve({code,out});});});}
const carousel=(a:string[])=>run(process.execPath,['--import','tsx','engine/cli.ts',...a],600_000);
async function projectFor(name:string){const all=await readdir(projects);return all.find(p=>p.endsWith('-'+name))?path.join(projects,all.find(p=>p.endsWith('-'+name))!):null;}
async function check(f:Fixture,dir:string){
 const results:{check:string;ok:boolean;detail?:string}[]=[];
 const out=(await carousel(['lint',dir])).out,lint=JSON.parse(out.slice(out.indexOf('{')));
 results.push({check:'lint sem erros',ok:lint.passed,detail:lint.issues.filter((i:any)=>i.severity==='error').map((i:any)=>i.message).join('; ')});
 const manifest=await readJson(path.join(dir,'render-manifest.json')).catch(()=>null);
 results.push({check:'render aprovado em todos os painéis',ok:!!manifest&&manifest.slides.every((s:any)=>s.passed)});
 const c=await readJson(path.join(dir,'carousel.json')),art=await readJson(path.join(dir,'art-direction.json'));
 if(f.expect.family)results.push({check:`família ${f.expect.family}`,ok:art.family===f.expect.family,detail:art.family});
 if(f.expect.central_metaphor)results.push({check:'metáfora central registrada e usada na direção de arte',ok:!!c.editorial.central_metaphor&&Object.values<any>(art.slides).some(d=>d.image.concept)});
 if(f.mode==='full'){const report=await readFile(path.join(dir,'editorial-report.md'),'utf8').catch(()=>'');results.push({check:'teste cego registrado',ok:/## Teste cego[\s\S]*(aprovad|reconstru)/i.test(report)});}
 if(f.expect.identical_copy)results.push({check:'copy idêntica à fonte',ok:!lint.issues.some((i:any)=>/difere/.test(i.message))});
 if(f.expect.floors){const fits=await Promise.all(c.slides.map((s:any)=>readJson(path.join(dir,`fit/${s.id}.json`)).catch(()=>null)));results.push({check:'nenhum body abaixo de 36 px',ok:fits.every((x:any)=>!x?.blocks?.body||x.blocks.body.size>=36)});results.push({check:'copy travada preservada (sem compressão sem aval)',ok:!lint.issues.some((i:any)=>/difere/.test(i.message))});}
 return results;
}
const report:any[]=[];
for(const f of fixtures.filter(x=>!only||only.includes(x.id))){
 const missing=await available(f);
 if(missing){report.push({fixture:f.id,name:f.name,status:'indisponível',detail:missing});continue;}
 if(dry){report.push({fixture:f.id,name:f.name,status:'pronto',detail:f.note});continue;}
 if(engineOnly&&f.mode==='full'){report.push({fixture:f.id,name:f.name,status:'pulado',detail:'modo full exige o Claude'});continue;}
 const started=Date.now();
 if(engineOnly){
  const r=await carousel(['from-copy',f.name,expand(f.source)]);const dir=await projectFor(f.name);
  if(dir&&!r.out.includes('"passed": true'))await carousel(['autofit',dir]);
  report.push({fixture:f.id,name:f.name,status:dir?'executado':'falhou',seconds:Math.round((Date.now()-started)/1000),checks:dir?await check(f,dir):[],log:dir?undefined:r.out.slice(-2000)});continue;
 }
 const prompt=[`Use a skill diego-carousel. Fixture de aceite ${f.id} (${f.name}): ${f.note}`,
  f.mode==='full'?`Modo full, sem checkpoint: fonte ${f.source}. Crie o projeto com o slug ${f.name}.`:`Copy pronta (design-only): crie o projeto com from-copy ${f.name} ${expand(f.source)}.`,
  'Vá até render, validate e uma revisão visual real (review --reviewer Claude). Não exporte. Não gere imagens pagas: deixe placeholders.',
  'Na última linha escreva apenas: PROJETO: <caminho do projeto>'].join('\n');
 const r=await run('claude',['-p',prompt,'--output-format','text','--allowedTools','Bash(npm run carousel:*),Bash(npm run -s carousel:*),Read,Write,Edit,Glob,Grep,Task,Agent'],45*60_000);
 const dir=await projectFor(f.name);
 report.push({fixture:f.id,name:f.name,status:dir?'executado':'falhou',exit:r.code,seconds:Math.round((Date.now()-started)/1000),checks:dir?await check(f,dir):[],transcript_tail:r.out.slice(-3000)});
}
if(dry)await rm(work,{recursive:true,force:true});
await mkdir(path.join(ROOT,'eval'),{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),base=path.join(ROOT,'eval',`report-${stamp}`);
await writeJson(base+'.json',{work,report});
const md=['# Avaliação das fixtures de aceite',`\n${new Date().toISOString()} · projetos em ${projects}\n`,...report.map(r=>`## ${r.fixture}. ${r.name} — ${r.status}\n\n${r.detail??''}${(r.checks??[]).map((c:any)=>`- ${c.ok?'✓':'✗'} ${c.check}${c.detail?` (${c.detail})`:''}`).join('\n')}\n`)].join('\n');
await writeFile(base+'.md',md);console.log(md);
if(report.some(r=>r.status==='falhou'||(r.checks??[]).some((c:any)=>!c.ok)))process.exitCode=1;
