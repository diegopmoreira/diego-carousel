import path from 'node:path';
import { z } from 'zod';
import { ROOT, readJson } from './io.js';
export const Config=z.object({
 schema_version:z.literal(1),
 autonomy:z.enum(['full','checkpoints']).default('full'),
 approval_mode:z.boolean().default(false),
 slides:z.object({default:z.number().int(),min:z.number().int().min(1),max:z.number().int().max(12)}).refine(s=>s.min<=s.default&&s.default<=s.max,'slides: min ≤ default ≤ max'),
 family:z.enum(['auto','cinematic_condensed','editorial_clean']).default('auto'),
 qa:z.object({max_auto_revision_cycles:z.number().int().min(1).max(10)}),
 branding:z.object({name:z.string(),handle:z.string(),avatar:z.string().nullable(),verified:z.boolean(),profile_on:z.enum(['cover','all']).default('cover'),swipe_text:z.string(),follow_text:z.string()}),
 assets:z.object({priority:z.array(z.string()),cover_variants:z.number().int(),body_variants:z.number().int(),max_generations_per_carousel:z.number().int()}),
 providers:z.record(z.string(),z.unknown()),
 preview:z.object({port:z.number().int()}),
 export:z.object({sync_dir:z.string().nullable()}),
});
export type ConfigData=z.infer<typeof Config>;
export async function loadConfig():Promise<ConfigData>{return Config.parse(await readJson(path.join(ROOT,'config.json')));}
