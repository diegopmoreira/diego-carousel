import sharp from 'sharp';
import path from 'node:path';
import { ROOT, readJson, writeJson, hash } from '../engine/project/io.js';
import { readFile } from 'node:fs/promises';
// The ring shows the avatar at 80 CSS px; 256 px keeps it sharp with a small, stable file for the render hash.
const brand=path.join(ROOT,'design/brand'),out=path.join(brand,'avatar.png');
await sharp(path.join(brand,'avatar-source.png')).resize(256,256,{fit:'cover',position:'centre'}).png({compressionLevel:9}).toFile(out);
const provenance=await readJson(path.join(brand,'provenance.json'));
provenance.processed={file:'avatar.png',size:256,fit:'cover centre',sha256:hash(await readFile(out))};
await writeJson(path.join(brand,'provenance.json'),provenance);
console.log(out);
