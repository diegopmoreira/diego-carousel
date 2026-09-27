import { it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { ROOT } from '../project/io.js';
import { Carousel, ArtDirection, Tweaks, Assets, AssetRequest } from './index.js';
import { DraftMeta } from '../project/draft.js';
// The generated JSON Schemas are what Claude reads; they must match the code (run `npm run schemas` after changes).
it('JSON Schemas gerados estão atualizados com os contratos',async()=>{
 for(const [name,schema] of Object.entries({carousel:Carousel,'art-direction':ArtDirection,tweaks:Tweaks,assets:Assets,'asset-request':AssetRequest,'editorial-meta':DraftMeta})){
  const file=JSON.parse(await readFile(path.join(ROOT,`engine/schema/generated/${name}.schema.json`),'utf8'));
  expect(file,`${name}.schema.json desatualizado: rode npm run schemas`).toEqual(JSON.parse(JSON.stringify(z.toJSONSchema(schema,{io:'input'}))));
 }
});
it('exemplos versionados seguem os contratos',async()=>{
 const read=async(f:string)=>JSON.parse(await readFile(path.join(ROOT,f),'utf8'));
 const docs:[{parse:(v:unknown)=>unknown},string][]=[[Carousel,'engine/schema/examples/carousel.json'],[ArtDirection,'engine/schema/examples/art-direction.json'],[Tweaks,'engine/schema/examples/tweaks.json'],[DraftMeta,'fixtures/full/editorial.json']];
 for(const [schema,file] of docs){const data=await read(file);expect(()=>schema.parse(data),file).not.toThrow();}
});
