import { it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './project/io.js';
// Claude follows the Skill and the docs literally: every command they mention must exist in the CLI,
// and every CLI command must be listed in its help.
it('comandos citados na Skill e na documentação existem no CLI',async()=>{
 const cli=await readFile(path.join(ROOT,'engine/cli.ts'),'utf8');
 const cases=new Set([...cli.matchAll(/case '([a-z-]+)':/g)].map(m=>m[1]));
 const help=cli.slice(cli.indexOf('const help=`'),cli.indexOf('`;',cli.indexOf('const help=`')));
 // Help lines may list several commands separated by " | ".
 const helped=new Set(help.split('\n').filter(l=>l.startsWith('  ')).flatMap(l=>l.split(/\s\|\s/).map(seg=>seg.trim().split(/\s/)[0])).filter(w=>/^[a-z][a-z-]+$/.test(w)));
 for(const c of cases)if(!['help','--help'].includes(c))expect(helped,`comando ${c} fora do help`).toContain(c);
 const docs=['.claude/skills/diego-carousel/SKILL.md','README.md','docs/sessao-local.md','visual/image-policy.md','editorial/thesis-selection.md','editorial/internal-headlines.md','editorial/language-style.md'];
 for(const doc of docs){
  const text=await readFile(path.join(ROOT,doc),'utf8');
  const mentioned=new Set([...text.matchAll(/carousel -- ([a-z][a-z-]+)/g),...text.matchAll(/`([a-z][a-z-]+) <projeto>/g)].map(m=>m[1]));
  for(const c of mentioned)expect(cases,`${doc} cita "${c}", que não existe no CLI`).toContain(c);
 }
});
it('scripts npm citados na documentação existem no package.json',async()=>{
 const scripts=Object.keys(JSON.parse(await readFile(path.join(ROOT,'package.json'),'utf8')).scripts);
 for(const doc of ['.claude/skills/diego-carousel/SKILL.md','README.md','docs/sessao-local.md','CLAUDE.md']){
  const text=await readFile(path.join(ROOT,doc),'utf8');
  for(const m of text.matchAll(/npm run (?:-s )?([a-z][a-z0-9:-]*)/g))expect(scripts,`${doc} cita npm run ${m[1]}`).toContain(m[1]);
 }
});
