import { z } from 'zod';
import { Carousel, ArtDirection, Tweaks, Assets } from '../engine/schema/index.js';
import { ROOT, writeJson } from '../engine/project/io.js';
for(const [name,schema] of Object.entries({carousel:Carousel,'art-direction':ArtDirection,tweaks:Tweaks,assets:Assets})) await writeJson(`${ROOT}/engine/schema/generated/${name}.schema.json`,z.toJSONSchema(schema,{io:'input'}));
