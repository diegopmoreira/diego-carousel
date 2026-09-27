# Plano — Sistema de Carrosséis Diego Moreira (V1)

## Contexto

A especificação v1.0 define um agente editorial + visual que transforma transcrições em carrosséis
P1–P10 publicáveis (modo `full`), diagrama copy pronta vinda de outro agente (`design-only`) e
permite ajustes (`rerender`) e variações visuais (`variant`). `~/diego-carousel` está vazio (não é
repo git). Este plano converte a spec em arquitetura concreta, contratos de dados, engine, Skill e
roadmap faseado — mantendo as decisões do §96 e refinando só onde a spec tinha ambiguidade ou
conflito interno.

Hoje o fluxo de Diego é: agente de copy → texto colado no plugin Figma "Marketing Insider OS"
(painéis separados por linha em branco, 1ª linha = headline) → export `Slide 1..10.png`.
O sistema substitui o passo Figma por HTML/CSS + Playwright e, no modo `full`, também o agente de copy.

## Insumos encontrados na máquina (e como entram)

| Insumo | Onde | Uso no sistema |
|---|---|---|
| Spec v1.0 (esta conversa) | — | fonte primária; destilada em `editorial/` e `visual/` |
| 77 carrosséis publicados (fev–jul/2026, 10 PNG 1080×1350 cada): 37 da Família A, 38 da B, 6 de uma família clara ("Template Twitter") | `~/Downloads/post*/Slide N.png` (ex.: A = `post31:07` "Inteligência emocional…"; B = `post7:7` "Mais de 25 anos e continua solteiro?") | calibrar tokens visuais; semente da biblioteca genética (Claude transcreve as spines) |
| Template Figma de origem (páginas "TEMPLATE ALTERNATIVO" = Família A e "TEMPLATE TWITTER"; camadas `#titulo-N`, `#corpo-N`, `img-N`, `PERFIL`, `RODAPÉ`, `CTA Seguir`; avatar embutido) | `~/Downloads/🔒 TEMPLATE BASE X CÓPIA PARA DUPLICAR (Copy).fig` | fonte das fontes/medidas exatas; extrair o avatar para `design/brand/` |
| Perfil intelectual APROVADO (lentes, construção didática, voz, critérios profundo/raso/pedante…) | `~/Library/Application Support/CorpusDiego/data/prompts/perfil_v1.md` | base de `core-dna.md` e `language-style.md` |
| Relatório de posicionamento v2/v3 (frameworks próprios: Homem de Pelúcia, Wendy vs Sininho, Linha de Sombra, Chinelagem…) | `~/Downloads/7_Lixo_Revisar/relatorio-posicionamento-diego-v2.txt` | glossário de frameworks e expressões-assinatura |
| Briefing "Rotina sem Neurose" §9–10 (regra de pronome, frases e headlines testadas) | `~/Downloads/Briefing_Rotina_sem_Neurose_para_Marketing.docx` | regra de voz; exemplos de headline |
| Funil ROTINA/ManyChat (último card "comenta PALAVRA") | `~/Downloads/BACKBONE_Funil_3_Tickets*.docx` | `cta.type = comment_keyword` |
| Plugin Figma (formato de entrada atual; cada slide tem perfil avatar+nome+@, título, corpo, `#index`, `#img`) | `~/Downloads/Plugin_figma_Marketing Insider OS v1-2/` | formato aceito no design-only; `copy.md` exportado nesse formato (plano B via Figma); confirma os componentes ProfileBadge, índice e slot de imagem |
| Corpus Diego (540 vídeos; fichas com tese/argumentos/citações) | MCP `corpus-diego` | fonte de transcrições por `video_id` + aterramento (`consultar_corpus`, falante=diego) |
| Fotos de Diego das landing pages | `~/Desktop/diegomoreira/{cdt,mhp,rsn}/…` | alternativa para o avatar, se a extração do `.fig` falhar |
| Padrão de adapters com teto de custo e log | `~/Desktop/analise_via_sticker/src/lib/ai/` | modelo para `engine/providers` |

Fora do mapa por decisão de Diego: o Coprodutor IA e o `~/carrossel-gpt` não entram no sistema.
Não encontrados: os documentos "Texto colado" do DNA (só existem dentro de chats). A spec é a fonte
operacional; os originais entram depois em `references/diego/dna/`. Nunca copiar `.env` ou
credenciais de outros projetos.

Ambiente: Node 23.6 (saiu de suporte; a Fase 0 fixa Node 24 LTS via Homebrew), Python
3.14 + uv, ffmpeg, ImageMagick, Chrome 153. Playwright ainda não instalado. Higgsfield: nada
configurado — existe MCP oficial (`https://mcp.higgsfield.ai/mcp`, OAuth, sem chave), CLI e API
REST (key id + secret).

## Decisões de arquitetura (e onde refino a spec)

1. **Claude julga, engine executa.** A Skill (`SKILL.md` maestro + base de conhecimento em Markdown)
   conduz tese → copy → direção de arte → QA. Um engine TypeScript determinístico, exposto como CLI
   `carousel`, cuida de schema, layout, fit, render, validação, export, preview e assets.
2. **Stack:** TypeScript + `tsx`; Playwright com Chromium empacotado e versão fixada (reprodutível;
   fallback `channel: 'chrome'`); `zod` (schemas + JSON Schema gerado para o Claude consultar);
   `sharp`; preview em `node:http` + UI vanilla (sem framework, sem build); `vitest` + goldens.
3. **Três camadas de dados, uma fonte de verdade por assunto.** Refina §57/§60, que duplicavam
   `composition`/`layout_overrides` em dois arquivos:
   `carousel.json` = conteúdo; `art-direction.json` = todas as decisões visuais;
   `tweaks.json` = ajuste numérico fino; `assets/manifest.json` = proveniência.
   Consequência: `variant` = mesmo `carousel.json` + outro `art-direction.json`/`tweaks.json`.
4. **IDs opacos de slide** (ex.: `k7f2`, nunca `s04`, que o Claude tenderia a renumerar): tweaks e
   direção de arte indexados por id; a ordem é a posição no array; `carousel slide add|move|rm`
   mantém tudo consistente e o `validate` acusa entradas órfãs.
5. **Tweaks = CSS custom properties**, com limites declarados por composição e marcados como
   `layout` (exige refazer o fit) ou `paint`. Os pisos tipográficos sempre vencem os tweaks.
6. **Fit calculado uma vez no Chromium fixado e congelado.** O runtime (`design/runtime/slide.js`)
   resolve a quebra de linhas no Playwright e grava `fit/<id>.json` com as linhas explícitas; preview
   e export mostram esse layout congelado (o inspector recalcula ao vivo só como aproximação e
   "Salvar" dispara o render real). Evita divergência entre o navegador do app, o Chrome e o
   Chromium do Playwright. Segue a ordem do §62: (1) quebra melhor → (2) respiro vertical moderado
   → (3) composição alternativa → (4) compressão editorial → (5) fonte até o piso. Em `full`, a
   escada roda inteira: o Claude decide 3–4 e, se ainda não couber, o runtime reduz a fonte até o
   piso. Em `design-only`, o passo 4 exige autorização de Diego (escada 1-2-3-5 + relatório do que
   cortar). `carousel fit-probe <id>` informa quais composições alternativas cabem e quantas
   palavras cortar. Pisos rígidos (só em `data-role` headline/body): body 36, headline 52, capa
   58 px — abaixo disso é falha e reescrita.
7. **Providers de imagem de dois tipos, mesmo manifesto:** *engine providers* (API chamada pelo
   código) e *agent providers* (MCP chamado pelo Claude, com arquivo registrado via
   `carousel asset add`). Além de `manual`, `library` e `video-frame` (ffmpeg sobre vídeo do Diego).
8. **Corpus como fonte e aterramento.** `source` aceita `.txt`, copy colada ou `corpus:<video_id>`;
   neste caso o engine lê a transcrição direto do disco
   (`~/Library/Application Support/CorpusDiego/data/transcricoes/<id>/v1.json`: `texto`,
   `segmentos`, `palavras`) em vez de o Claude reemitir até 60 mil caracteres. O MCP fica para
   busca e aterramento (`falante=diego`). Supervisões e conversas ficam fora por padrão, também nas
   consultas de aterramento: a busca devolve casos clínicos de terceiros, que nunca podem aparecer.
9. **Skill em `.claude/skills/diego-carousel/SKILL.md`** (descoberta pelo Claude Code, invocável por
   `/diego-carousel` ou pedido em linguagem natural). O conhecimento (`editorial/`, `visual/`,
   `genetic-library/`) fica visível na raiz para Diego editar.
10. **`export/` só com o publicável** (`01.png…NN.png`); artefatos de QA em `qa/`.
11. **Adições pequenas à spec:** `caption` (legenda do post), `copy.md` derivado, `ideas/backlog.jsonl`
    (as outras boas teses do mesmo vídeo) e `cta.keyword` para o fluxo ManyChat.
12. **Voz: sempre "tu"** (decisão de Diego), inclusive capa e headlines. Conjugação coloquial,
    como no briefing: "tu faz", "tu é", "tu sabe"; imperativo "para de…", "aprende", "segue";
    "teu/tua", "pra ti", "contigo". O lint trata "você" como erro e "seu/sua" como aviso
    (ambíguos), e bloqueia o tom proibido do briefing ("você merece", "transforme sua vida",
    "descubra o segredo", "junto com você nessa jornada", "vamos juntos", "acredite em si mesmo").
    Regra de ouro do briefing, que vai para `language-style.md`: motivacional, terapêutico-fofo ou
    gringo demais → fora; clínico, direto, intelectualmente honesto → dentro.
13. **Imagens: Higgsfield via MCP oficial** (OAuth, sem chave) como provider principal, e
    **gpt-image** quando fizer sentido (disponível dentro do próprio Higgsfield; API direta da
    OpenAI só se precisar gerar sem o Claude, gerando em 1088×1360 porque os lados devem ser
    múltiplos de 16, e recortando depois). Nada de DALL·E. Fluxo único de "ticket":
    `carousel asset request <id>` monta o prompt canônico, a proporção suportada, o negativo "sem
    texto" e checa o teto de gastos; o Claude gera; `carousel asset add --request <r> --url <u>` baixa
    na hora (URLs expiram) e grava sha256 + request completo. Cada imagem gerada é conferida
    visualmente para não conter texto.

## Linguagem visual medida (ponto de partida dos tokens)

Medições aproximadas nos PNGs publicados; a Fase 2 refina com medição precisa e confere no `.fig`.

| | Família A — `cinematic_condensed` | Família B — `editorial_clean` |
|---|---|---|
| Fundo | foto de filme em largura total, y 0→~660 (~50%), fade para `#000000` | `#0B0B0B` liso |
| Headline | **Anton SC**, caixa alta, `#F1F1F1`, x≈50, início y≈666, ~90–96 px, entrelinha ~0.9, 2–3 linhas | **Inter ExtraBold**, caixa de frase, `#F1F1F1`, x=60, topo y≈228, ~60–64 px, entrelinha ~75 px |
| Body | **Montserrat Medium**, `#E3E3E3`, ~34–36 px, entrelinha ~50 px, ~50 px abaixo da headline | **Inter**, `#CBCBCB`, ~37–38 px, entrelinha ~52 px |
| Imagem no miolo | topo, sangrando | card 960×~485 (~2:1), x 60–1019, y ~645–1130, raio ~30–32 px, sem sombra |
| Capa | foto full-bleed + gradiente inferior; pilha no canto inferior esquerdo: avatar ~88 px com anel estilo Instagram (`#FFA301→#FF6724→#8E48AF`), "Diego Moreira" (Inter Medium) + selo azul `#1976D2`, @ em `#C8C8C8`; headline Anton SC | foto full-bleed + gradiente; tudo centralizado: avatar, nome, selo, @, headline Inter Bold ~70 px, "Arrasta para o lado >" branco centralizado |

**Comum às duas:** rodapé com pílula `@odiego.moreira` (x 49–265, y 1256–1309, `#0D0D0D`, borda 1 px
`#2E2E2E`, Inter SemiBold ~20 px) à esquerda e "Arrasta para o lado >" (`#747474`) à direita; no
penúltimo slide a direita vira CTA "Siga o perfil para mais conteúdos como esse!" com ícone vermelho.
Isso define os componentes V1: `ProfileBadge` (anel + selo), `HandlePill`, `SwipeCue`, `FollowCTA`.
Pela regra "sempre tu", o texto do CTA passa a "Segue o perfil…" ("Arrasta" já está em "tu");
todos esses textos ficam em `config.json`.

- **Fontes a vendorizar (OFL):** Anton SC, Montserrat, Inter — nenhuma está instalada. Vêm dos
  pacotes Fontsource (`@fontsource/anton-sc`, `@fontsource/montserrat`, `@fontsource-variable/inter`,
  versões fixadas no lockfile); um script copia os woff2 (latin + latin-ext) e as licenças para
  `design/fonts/` e registra hashes.
- **Conflito com a spec:** o body real da Família A (~34–36 px) fica no limite do piso de 36 px.
  Prevalece o piso (legibilidade > fidelidade, §102); a diferença visual é mínima.
- **Família clara "Template Twitter"** (6 carrosséis): fora da V1; entra depois como terceira família
  só com tokens.
- **Fotos de filme:** Diego usa stills de filmes como associação cultural. O sistema pode *sugerir*
  a cena na direção de arte e pedir o frame a Diego, ou gerar uma imagem original que evoque o
  clima; nunca baixa material protegido por conta própria (§56).

## Estrutura do repositório

```
diego-carousel/
├── .claude/skills/diego-carousel/SKILL.md   # maestro (§79)
├── .claude/launch.json                       # preview no painel Browser do app
├── .mcp.json                                 # Higgsfield MCP (escopo de projeto, OAuth, sem segredo)
├── CLAUDE.md · README.md · config.json · .env.example · package.json · tsconfig.json
├── editorial/  core-dna · source-compression · thesis-selection · hook-matrix · viral-score ·
│               narrative-architectures · internal-headlines · continuity · language-style · editorial-qa
├── visual/     visual-dna · typography · compositions · art-direction · cinematic-condensed ·
│               editorial-clean · image-policy · visual-qa
├── design/     tokens.json · families/*.json · css/{base,families,compositions}/ · runtime/slide.js · fonts/ · brand/
├── genetic-library/{editorial,visual}/*.yaml
├── references/{diego,external}/
├── engine/     cli.ts · schema/ · project/ · render/{compositions,components}/ · qa/ · export/ · preview/ · providers/ · source/
├── fixtures/   5 fixtures de aceite + goldens
├── library/images/ (+ index.json)            # biblioteca visual própria
├── ideas/backlog.jsonl
└── projects/YYYY-MM-DD-slug/
      carousel.json · art-direction.json · tweaks.json · editorial-report.md · copy.md · run.log
      render-manifest.json (versões do engine/Chromium/fontes, hash de cada PNG)
      source/ · assets/{source,generated/alternatives,processed}/ + manifest.json
      html/slide-NN.html · export/NN.png · qa/ · preview/index.html
      variants/<nome>/{art-direction.json,tweaks.json,html/,export/}
```

Ajustes ao §78: `tokens.json` fica só em `design/` (a spec o citava em `visual/` e em `design/`);
`components/`, `adapters/` e `scripts/` viram `engine/` (TS) + `design/css`.

## Contratos de dados (resumo)

- **carousel.json** — `schema_version`; `project{id, created_at, skill_version, engine_version,
  language, canvas, mode, copy_locked}`; `source{type: transcript_file|corpus_video|copy_input, ref,
  title, hash}`; `editorial{objective, audience, angle, promise, central_thesis, belief,
  contradiction, mechanism, architecture(+hybrid), hook{text, family, viral_score{impact, clarity,
  originality, tension, utility, shareability}, defensibility, progression}, hook_candidates[],
  central_metaphor, cta{type: none|share_specific|comment_keyword, text, keyword}, caption}`;
  `slides[]{id, narrative_role, headline, body|null, headline_type, adds[], next_question,
  visual_intent}` (a numeração P1…Pn sai da posição no array; `headline_type` evita confusão com a
  `family` visual).
- **Markup de texto:** `**ênfase**` com estilo definido por família nos tokens (padrão: sem destaque
  visual, como nos carrosséis publicados; opções: cor de acento, branco sobre corpo cinza); `\n` =
  quebra forçada. O conteúdo fica em caixa natural; caixa alta é aplicada por CSS da família. No
  `import-copy`, palavras em CAIXA ALTA da copy de entrada são preservadas como estão e marcadas
  como ênfase. Todo texto de entrada é normalizado em NFC.
- **art-direction.json** — `family, cover_strategy, rationale`; `slides{sid: {visual_role,
  composition, density LOW|MEDIUM|HIGH, layout{headline_position, align}, image{need, concept, mood,
  subject_priority, crop, negative_space, strategy, asset_id, alternatives[], focal_point{x,y}},
  fit{headline: fill|preferred}}}` (a permissão para encolher fonte não fica aqui: segue a escada
  do modo e, quando exige autorização, `approvals.json`).
- **tweaks.json** — `{"k7f2": {"composition": "cinematic_fade", "params": {"headline_size_delta": 6,
  "image_y": -24, "image_scale": 1.08}}}`; limites vêm de `design/compositions/<nome>/meta.json`.
- **assets/manifest.json** — `{id, file, sha256, origin: user|library|video_frame|licensed|generated|
  external, rights, provider, model, request, prompt, negative, seed, params, created_at, credit,
  width, height, focal_point, used_by[], score, rationale}`. Stills de filme só entram como `manual`,
  com `rights` preenchido; geração nunca imita pessoas reais.
- **approvals.json** — autorizações dadas por Diego (ex.: comprimir copy travada), gravadas pelo CLI,
  não pelo Claude.
- **config.json** — `autonomy` (full), `approval_mode` (false), `slides{default: 10, min: 8, max: 12}`,
  `family` (auto), `qa.max_auto_revision_cycles` (3), `branding{name, handle, avatar, verified,
  swipe_text, follow_text}`, `assets{priority[], cover_variants: 3, body_variants: 1,
  max_generations_per_carousel}`, `providers{default, higgsfield{mode: mcp}}`, `preview.port` (4321),
  `export.sync_dir`.
- Tudo validado por `carousel validate` (`--json` aponta erros pelo caminho no JSON); cada arquivo
  tem `schema_version` e ponteiro `$schema`; exemplos anotados em `engine/schema/examples/`, que o
  Claude segue melhor que o schema puro; `carousel migrate` para versões antigas.
- Convenção: chaves JSON e código em inglês (como na spec); conteúdo, base de conhecimento e
  relatórios em PT-BR.

## Engine — CLI `carousel`

| Comando | Faz |
|---|---|
| `new <slug> --source <txt\|corpus:ID\|copy>` | cria o projeto, copia a fonte, registra hash; limpeza leve e determinística (remove timestamps e "N segundos" do copiar-colar do YouTube, mantém títulos de capítulo como pistas) — a normalização intelectual é do Claude |
| `import-copy <proj> <arquivo>` | design-only: `P1…`/`Slide N`, ou painéis separados por linha em branco (formato do plugin Figma) → carousel.json com `copy_locked`; não assume 10 painéis |
| `lint <proj>` / `spine <proj>` | QA editorial determinístico / imprime só as headlines |
| `status <proj>` | livro-razão das fases (o que está feito para o hash atual) — sobrevive à compactação de contexto |
| `slide add\|move\|rm` · `fit-probe <id>` | edição estrutural segura · opções de fit para um slide que não cabe |
| `render <proj> [--slides <ids>] [--variant v]` | HTML + PNG + relatório de fit; incremental por hash dos insumos de cada slide |
| `validate <proj>` / `export <proj>` | hard gates (exit≠0 se falhar) / PNG finais + contact sheet + preview estático + `render-manifest.json` |
| `preview [proj]` | servidor em localhost:4321 (o painel do Corpus usa 8876) |
| `variant <proj> <nome>` / `promote <proj> <nome>` | variantes visuais |
| `asset request\|add\|list\|frames\|candidates` | ticket de geração, registro com proveniência, alternativas |
| `gallery` · `library ingest <pasta>` · `log <proj> <TAG> <msg>` · `doctor` | vocabulário visual, referências, log `[EDITORIAL] [HOOK]…`, checagem do ambiente |

**Pipeline de render:** resolve (tokens → família → composição → layout → tweaks = CSS vars) →
compose (funções TS que geram HTML com escape; cada composição mora em
`design/compositions/<nome>/` com template, CSS, `meta.json` e README) → `html/slide-NN.html`
(fontes locais, `runtime/slide.js`) servido pela mesma origem `127.0.0.1` no preview e no export
(não `file://`, o que também torna o gate de 404 confiável) → Playwright 1080×1350, dsf 1,
`--force-color-profile=srgb` → aguarda `__slideReady` → screenshot. Robustez de carregamento:
`document.fonts.load(face, textoReal)` para cada fonte antes do fit (o `fonts.ready` resolve cedo
demais), `<img>` + `decode()` em vez de background CSS, `font-synthesis: none` (Anton SC só tem
peso 400). Versão do navegador e sha256 das fontes vão para o `render-manifest.json`.

**Runtime de fit:** quebrador de linhas por programação dinâmica que mede palavras no DOM, com
penalidade para palavra curta do PT (a, o, e, de, da, do, em, no, na, um, que, se, não…) no fim da
linha — penalidade, não NBSP, porque cadeias de NBSP criam blocos inquebráveis que estouram
headlines grandes; `fill` para capa/`giant_statement` por busca binária em px inteiros (linhas ≤
max, altura ≤ caixa, maior palavra ≤ largura); linhas contadas agrupando `Range.getClientRects()`
por topo; relatório `{overflow_px, lines, chars_that_fit}`.

**Hard gates (§67):** canvas exato; nenhum overflow (scroll vs client e linhas ≤ max); nenhum texto
fora do canvas/margem segura; fontes carregadas **e** nenhum fallback (pré-checagem de cobertura de
glifos contra os arquivos de fonte vendorizados + CDP `CSS.getPlatformFontsForNode`); nenhum
request falho/404; nenhum erro de console; pisos tipográficos; todos os PNG presentes com 1080×1350;
**mapa de tinta**: um screenshot extra sem imagens, com cada linha de headline em cor alternada e o
body em outra, verifica que a tinta real fica na área segura, que blocos não se sobrepõem e que cada
acento fica mais perto da própria linha que da de cima — o problema já aparece em `post31:07`
(o til de "NÃO" encosta na linha anterior); na falha, sobe a entrelinha daquele bloco. Falha →
`export` recusa. Detalhes visuais: `SwipeCue` escondido no último slide (em `post31:07` ele ainda
aparece no slide 10) e dither leve nos gradientes para não criar faixas após a recompressão JPEG
do Instagram.

**Ordem garantida pelo CLI, não pela prosa:** `render` exige lint aprovado para o hash atual do
conteúdo; `export` exige `validate` + `qa/visual-review.json` (com contador de ciclos) para o hash
atual do render; como o render é incremental por hash, "só o slide ajustado muda" vale por
construção e exports ou variantes desatualizados ficam detectáveis.

**Lint editorial** (parte determinística de §41/§88): 8–12 slides; P1 sem body; headline ≥ 3
palavras (anti-rótulo "Medo"); faixa de caracteres do body; headlines quase duplicadas;
`next_question` em P1…P(n-1); `adds` repetido em slides vizinhos; frases proibidas ("antes de
começar", "neste carrossel", "siga meu perfil", "compartilhe com seus amigos", "5 dicas"…) e o tom
proibido do briefing; regra "sempre tu"; com `copy_locked`, qualquer diferença contra
`source/copy-input` é erro. Limites numéricos começam como **aviso** e são calibrados nos carrosséis
publicados (ex.: a faixa 200–350 da spec acusaria o slide 3 de `post31:07`, com ~157 caracteres).
Em modo `full`, o lint também exige que `editorial-report.md` tenha todas as seções do pipeline
(mapa da fonte, diagnóstico, teses, hooks com notas, spine).

**Lint visual:** nunca todos os slides HIGH; no máximo 2 composições iguais seguidas; toda slide
com `image.need` tem asset ou placeholder declarado.

## Skill — maestro e base de conhecimento

`SKILL.md` (≤ ~300 linhas): quando ativar; detecção de modo (transcrição/corpus → `full`; copy
pronta → `design-only`; "aumente/mova/troque" em projeto existente → `rerender`; "outro estilo/outra
capa" → `variant`); pipeline dizendo o que ler em cada fase; hard gates; comandos; checkpoints;
política de fonte. Pipeline `full` (§80):

1. **Fonte** → ler `core-dna`, `source-compression` → mapa da fonte no `editorial-report.md` (ideias,
   metáforas, contrastes; cada ideia acompanhada da citação literal de Diego que a sustenta). Depois
   disso o Claude trabalha sobre o mapa e só volta à transcrição para buscar trechos pontuais —
   mantém o contexto enxuto.
2. **Diagnóstico e teses** → `thesis-selection` (+ `consultar_corpus` falante=diego para checar
   defensabilidade e achar formulações próprias; `mapa_conceitual` para ligar a tese aos conceitos
   e frameworks de Diego) → escolhe UMA; as demais vão para `ideas/backlog.jsonl`.
3. **Hooks** → `hook-matrix`, `viral-score` → 5–10 hooks de famílias distintas, nota por dimensão,
   regra de piso, escolha por curiosidade + defensabilidade + espaço para progressão.
4. **Arquitetura e Title Spine** → `narrative-architectures`, `internal-headlines`, `continuity` +
   2–3 exemplos da biblioteca genética → spine com `next_question`. Teste cego: um subagente recebe
   só as headlines e diz se elas contam a história e qual seria a tese; se não bater, corrige a
   spine antes de escrever os bodies.
5. **Bodies** → `language-style` → `carousel.json` + `copy.md` + legenda.
6. **QA editorial** → `editorial-qa` + `carousel lint`.
7. **Direção de arte** → `visual-dna`, `compositions`, `art-direction`, arquivo da família →
   `art-direction.json` (heurística §82, densidade §83, ritmo §84).
8. **Assets** → `image-policy` (prioridade §56).
9. **Render e QA** → `render` → `validate` → Claude lê o contact sheet e cada PNG, compara com a
   direção de arte, corrige; no máximo 3 ciclos → `qa/visual-review.json`.
10. **Export e preview.**

**Checkpoints** (`approval_mode` no config ou "com aprovação" no pedido): (1) tese + hooks via
pergunta de múltipla escolha; (2) spine + copy completa; (3) preview aberto. Padrão `autonomy: full`.
**design-only:** copy gravada verbatim em `source/copy-input.md`; o Claude aponta problemas objetivos
(overflow, repetição), mas só reescreve com autorização (registrada em `approvals.json`), e toda
mudança fica registrada. **Edição de JSON:** depois de aprovado, o Claude altera arquivos com edições
pontuais, nunca reescrevendo o arquivo inteiro. **Pedidos ambíguos** ("outra capa" = outra imagem,
outra estratégia ou outro hook?) → pergunta antes.

## Roadmap

**Primeira rodada de implementação: Fases 0–2** (decisão de Diego). As fases 3–7 ficam planejadas
e entram em rodadas seguintes. Ordem de execução dentro da rodada: **Fase 0 → Fase 2 com
`design-only` → Fase 1 → E2E `full`**. Assim Diego já pode trocar o Figma pelo sistema usando a copy
que tem hoje, e o contrato `carousel.json` é validado pelo renderer antes do motor editorial.

**Fase 0 — Fundação.** git init + `.gitignore` (binários de `projects/` e `.env` fora do git);
Node 24 LTS fixado (`.nvmrc` + `engines`); package.json/tsconfig; deps (playwright com versão exata
+ chromium, zod, sharp, tsx, vitest); fontes vendorizadas
com OFL (Anton SC, Montserrat, Inter); avatar extraído do `.fig` para `design/brand/`; tokens
iniciais com as medidas acima; schemas zod + JSON Schema; CLI esqueleto (`new`,
`log`, `doctor`); config.json; CLAUDE.md; README; launch.json; cópia para `references/diego/` de
5–10 carrosséis publicados + perfil, briefing e relatório (sem credenciais).
*Pronto quando:* `carousel doctor` verde, `vitest` passa, schemas validam um exemplo.

**Fase 1 — Núcleo editorial.** 10 arquivos `editorial/*.md`; SKILL.md (fases 1–6, modo `full`,
checkpoints — nas primeiras semanas, checkpoint padrão logo após a tese); `lint`, `spine`,
`copy.md`, backlog; semente da biblioteca genética (Claude transcreve 5–10 carrosséis publicados →
YAML com tese, arquitetura e spine) e calibração dos limites do lint nesses exemplos.
*Pronto quando:* 3 transcrições inéditas geram `carousel.json` + `editorial-report.md` com lint
limpo, o teste cego de spine passa, e Diego reconhece o DNA lendo as spines.

**Fase 2 — Renderer (MVP ponta a ponta).**
- Tokens calibrados recriando 3 slides publicados e comparando pixel a pixel (`magick compare`),
  conferidos no `.fig`.
- `import-copy` + modo `design-only` na Skill (entra aqui para Diego já largar o Figma).
- Componentes (§71) e 8 composições: primeiro as 5 que reproduzem o que Diego já publica
  (`full_bleed` capa A/B, `cinematic_fade`, `image_card`, `text_only`, `giant_statement`), depois
  `minimal_pause`, `quote`, `contrast` (variações baratas que dão ritmo).
- Runtime de fit; `render` / `validate` / `export`; contact sheet; preview estático; `gallery`.
- `asset add` (arquivo manual ou resultado vindo de MCP) e placeholder digno quando falta imagem.
  Se o MCP Higgsfield já estiver conectado, a Skill gera e registra a imagem da capa já nesta fase:
  `claude mcp add --transport http higgsfield --scope project https://mcp.higgsfield.ai/mcp`
  (`.mcp.json` versionado, sem segredo) + login OAuth com `/mcp` ou `claude mcp login higgsfield`.
- SKILL.md fases 7–10 com o 1º ciclo de QA multimodal.
- Goldens + mapa de tinta, incluindo caixa alta acentuada ("AÇÃO", "NÃO", "É") com entrelinha 0.92.

*Pronto quando:* fixtures 4 e 5 passam (design-only ponta a ponta, sem Figma). Ao fim da rodada,
já com a Fase 1, uma transcrição vira 10 PNG 1080×1350 sem overflow.

**Fase 3 — Preview e tweaks** (antecipada em relação à spec: não depende de credenciais e destrava o
ajuste fino). Servidor; modos Carrossel / Grade / Instagram (feed com avatar e legenda + grade 3:4 do
perfil) / Safe area; iframes com o mesmo HTML do export; inspector com sliders → CSS vars ao vivo →
salva `tweaks.json` (escrita atômica com checagem de mtime, porque o Claude edita os mesmos arquivos)
→ render do slide; seletor de alternativas de imagem; live
reload via SSE quando o Claude edita arquivos; modos `rerender` e `variant` na Skill; entrega no
celular copiando o `export/` para uma pasta sincronizada configurável (ex.: iCloud Drive).
*Pronto quando:* "aumente o título do slide 4" altera só `tweaks.json` e re-renderiza só aquele
slide; a variante "estilo B" gera export paralelo sem tocar a copy.

**Fase 4 — Inteligência visual.** Direção de arte completa (conceito, mood, crop, foco acima do
fade); `image-policy` com guia de prompt ("sem texto", proporções); fichas curtas por provider em
`visual/providers/` (Higgsfield MCP, gpt-image), para o SKILL.md não depender de nomes de
ferramentas; interface `ImageProvider`; `video-frame`; biblioteca de imagens;
3 variantes de capa + `asset candidates` (renderiza a capa com cada alternativa e a headline real
para o Claude pontuar composição, leitura, espaço para texto, coerência, novidade e identidade);
composições restantes (`editorial_split`, `diagram`, `sequence`, `annotated_image`, `metaphor`).
Regras: nenhum texto em imagem gerada; nenhuma semelhança com pessoas reais; nada de coleta
automática de material protegido; teto de gerações por carrossel com log de custo.
*Pronto quando:* fixture 3 (metáfora forte) usa a metáfora visualmente e a capa sai de 3 variantes
com justificativa no manifesto.

**Fase 5 — QA multimodal completo.** Contraste medido (render sem texto → luminância sob cada bloco →
razão WCAG), dead space, sobreposição não prevista, monotonia, teste "parece deck SaaS de IA?";
ciclo formal de no máximo 3 rodadas com marcação para revisão humana; `npm run eval` roda as 5
fixtures via `claude -p`.

**Fase 6 — Biblioteca genética contínua.** Ingestão dos demais carrosséis publicados (melhores
primeiro), anotação visual, seleção de exemplos por arquitetura.

**Fase 7 — Analytics.** `metrics.json` por projeto (schema §77), `carousel metrics add`, relatório
comparativo após 20–30 posts. Métricas informam, não reescrevem o DNA.

## Verificação

**Fixtures (§94)**, montadas na Fase 0 a partir do material existente:
1. Emocional/conceitual → espera `cinematic_condensed`: `~/Downloads/Texto colado.txt` ("O tipo de
   homem que sempre se arrebenta", Jung/anima).
2. Diagnóstico denso → espera `editorial_clean`: vídeo público do Corpus com vários mecanismos
   (escolhido no catálogo na Fase 0; nunca supervisão).
3. Metáfora forte: vídeo público do Corpus sobre carência afetiva (sede → água salgada → poça → poço),
   escolhido no catálogo na Fase 0.
4. Copy pronta (design-only): um carrossel publicado transcrito no formato do plugin Figma.
5. Body excessivo: copy sintética com bodies de 600+ caracteres.

- **Unit:** `npx vitest` — schemas, markup, quebrador de linhas, `import-copy` nos formatos aceitos,
  lint, resolução de tweaks, hashes do render incremental.
- **Render:** goldens por composição × família (diff de screenshot Playwright) + gates nas fixtures.
- **E2E (Fase 2):** `/diego-carousel` com o vídeo do corpus `lE--NmXpw5o` ("Todo sarcástico é um
  invejoso assustado") → `carousel validate` verde, 10 PNG 1080×1350, contact sheet revisado.
- **Design-only:** colar copy no formato do plugin Figma → `lint` confirma texto idêntico.
- **Overflow:** fixture 5 → `run.log` mostra a ordem quebra → respiro → composição → compressão →
  fonte até o piso (em `design-only`, sem compressão não autorizada).
- **Rerender:** tweak em um slide → só ele muda (hashes dos demais PNG iguais no `render-manifest.json`).
- **Critérios §93:** editorial (Fase 1), estrutura (spine), visual (Fases 2/4), técnica (gates),
  automação (E2E sem editar código), editabilidade (Fase 3), qualidade (ciclo de QA da Fase 2).

## O que depende do Diego (nada bloqueia a Fase 0)

- Originais do DNA ("Textos colados") → `references/diego/dna/` quando possível (não bloqueia:
  seguimos com a spec).
- Indicar os 5–10 carrosséis publicados que mais performaram (sementes da biblioteca).
- Confirmar o avatar extraído do template (ou enviar o oficial). As fontes já foram identificadas
  no `.fig`.
- Login OAuth no Higgsfield ao conectar o MCP (pode ser já na Fase 2 para gerar capas).