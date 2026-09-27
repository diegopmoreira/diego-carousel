import { z } from 'zod';
import { Carousel, ArtDirection, Tweaks, Assets, AssetRequest } from '../engine/schema/index.js';
import { ROOT, writeJson } from '../engine/project/io.js';
import { DraftMeta } from '../engine/project/draft.js';
for(const [name,schema] of Object.entries({carousel:Carousel,'art-direction':ArtDirection,tweaks:Tweaks,assets:Assets,'asset-request':AssetRequest,'editorial-meta':DraftMeta})) await writeJson(`${ROOT}/engine/schema/generated/${name}.schema.json`,z.toJSONSchema(schema,{io:'input'}));
