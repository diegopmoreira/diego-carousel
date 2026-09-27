import { z } from 'zod';
export const VERSION = '0.1.0';
const header = { schema_version: z.literal(1), $schema: z.string().optional() };
const text = z.string().transform(v => v.normalize('NFC'));
const id = z.string().regex(/^[a-z][a-z0-9_-]{3,63}$/);
export const Family = z.enum(['cinematic_condensed', 'editorial_clean']);
export const Composition = z.enum(['full_bleed', 'cinematic_fade', 'image_card', 'text_only', 'giant_statement', 'minimal_pause', 'quote', 'contrast']);
export const IMAGE_COMPOSITIONS:readonly string[] = ['full_bleed', 'cinematic_fade', 'image_card'];
export const Slide = z.object({
  id, narrative_role: text, headline: text.pipe(z.string().min(1)), body: text.nullable(),
  headline_type: text.default('statement'), adds: z.array(text).default([]),
  next_question: text.default(''), visual_intent: text.default(''),
}).strict();
const score = z.object(Object.fromEntries(['impact','clarity','originality','tension','utility','shareability'].map(k => [k, z.number().min(0).max(10)])));
export const Carousel = z.object({
  ...header,
  project: z.object({id, created_at: z.iso.datetime(), skill_version: z.string(), engine_version: z.string(), language: z.literal('pt-BR'), canvas: z.object({width: z.literal(1080), height: z.literal(1350)}), mode: z.enum(['full','design-only']), copy_locked: z.boolean()}).strict(),
  source: z.object({type: z.enum(['transcript_file','corpus_video','copy_input']), ref: z.string(), title: text, hash: z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
  editorial: z.object({
    objective: text.default(''), audience: text.default(''), angle: text.default(''), promise: text.default(''), central_thesis: text.default(''), belief: text.default(''), contradiction: text.default(''), mechanism: text.default(''), architecture: text.default(''), hybrid: z.array(text).default([]),
    hook: z.object({text, family: text, viral_score: score.optional(), defensibility: text, progression: text}).optional(),
    hook_candidates: z.array(z.object({text, family: text, viral_score: score.optional()})).default([]), central_metaphor: text.default(''),
    cta: z.object({type: z.enum(['none','share_specific','comment_keyword']), text, keyword: text.optional()}).refine(v => v.type !== 'comment_keyword' || !!v.keyword?.trim(), 'CTA comment_keyword exige keyword'), caption: text.default(''),
  }).strict(),
  slides: z.array(Slide).max(12),
}).strict().superRefine((v, ctx) => {if(v.source.type==='copy_input'&&!v.project.copy_locked)ctx.addIssue({code:'custom',path:['project','copy_locked'],message:'Copy importada deve permanecer travada'});const ids=v.slides.map(s=>s.id); if(new Set(ids).size!==ids.length) ctx.addIssue({code:'custom',path:['slides'],message:'IDs duplicados'});});
export const ArtDirection = z.object({
  ...header, family: Family, cover_strategy: text, rationale: text,
  slides: z.record(id, z.object({
    visual_role: text, composition: Composition, density: z.enum(['LOW','MEDIUM','HIGH']),
    layout: z.object({headline_position: z.enum(['top','center','bottom']), align: z.enum(['left','center'])}).strict(),
    image: z.object({need: z.boolean(), placeholder: z.boolean().default(false), concept: text.default(''), mood: text.default(''), subject_priority: text.default(''), crop: text.default('cover'), negative_space: text.default(''), strategy: z.enum(['none','manual','library','generated','video_frame']).default('none'), asset_id: id.optional(), alternatives: z.array(id).default([]), focal_point: z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1)}).default({x:.5,y:.5})}).strict(),
    fit: z.object({headline:z.enum(['fill','preferred'])}),
  }).strict()),
}).strict();
export const Tweaks = z.object({...header, slides:z.record(id,z.object({composition:Composition.optional(), params:z.object({headline_size_delta:z.number().min(-24).max(24).optional(),body_size_delta:z.number().min(-4).max(8).optional(),image_y:z.number().min(-200).max(200).optional(),image_scale:z.number().min(1).max(1.5).optional(),block_gap:z.number().min(24).max(72).optional()}).strict()}).strict())}).strict();
export const Assets = z.object({...header, assets:z.array(z.object({id, file:z.string(), sha256:z.string().regex(/^[a-f0-9]{64}$/), origin:z.enum(['user','library','video_frame','licensed','generated','external']), rights:z.string().min(1), provider:z.string(), model:z.string().optional(), request:z.unknown().optional(), prompt:z.string().optional(), created_at:z.iso.datetime(), credit:z.string().default(''), width:z.number().positive(),height:z.number().positive(),used_by:z.array(id).default([])}).strict())}).strict();
export type CarouselData = z.infer<typeof Carousel>;
export type ArtData = z.infer<typeof ArtDirection>;
export type TweaksData = z.infer<typeof Tweaks>;
export type AssetsData = z.infer<typeof Assets>;
