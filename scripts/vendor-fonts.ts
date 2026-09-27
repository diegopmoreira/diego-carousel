import { copyFile, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, hash, writeJson } from '../engine/project/io.js';
const specs=[['@fontsource/anton-sc','Anton SC','400','anton-sc-latin-400-normal.woff2','400.css'],['@fontsource/anton-sc','Anton SC','400','anton-sc-latin-ext-400-normal.woff2','400.css'],['@fontsource/montserrat','Montserrat','500','montserrat-latin-500-normal.woff2','500.css'],['@fontsource/montserrat','Montserrat','500','montserrat-latin-ext-500-normal.woff2','500.css'],['@fontsource-variable/inter','Inter','100 900','inter-latin-wght-normal.woff2','wght.css'],['@fontsource-variable/inter','Inter','100 900','inter-latin-ext-wght-normal.woff2','wght.css']];
await mkdir(path.join(ROOT,'design/fonts'),{recursive:true});
const manifest=[];let css='';
for(const [pkg,family,weight,file,cssFile] of specs){
 const src=path.join(ROOT,'node_modules',pkg);const bytes=await readFile(path.join(src,'files',file));
 await copyFile(path.join(src,'files',file),path.join(ROOT,'design/fonts',file));
 await copyFile(path.join(src,'LICENSE'),path.join(ROOT,'design/fonts',pkg.replaceAll('/','-')+'-LICENSE'));
 const upstream=await readFile(path.join(src,cssFile),'utf8');const block=upstream.split('@font-face').find(b=>b.includes(file));const range=block?.match(/unicode-range:\s*([^;]+);/)?.[1];
 if(!range)throw Error(`unicode-range ausente: ${file}`);
 css+=`@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;src:url('./${file}') format('woff2');unicode-range:${range};}\n`;
 manifest.push({file,family,weight,sha256:hash(bytes)});
}
await import('node:fs/promises').then(fs=>fs.writeFile(path.join(ROOT,'design/fonts/fonts.css'),css));
await writeJson(path.join(ROOT,'design/fonts/manifest.json'),manifest);
console.log(`${manifest.length} fontes locais com licença e SHA-256`);
