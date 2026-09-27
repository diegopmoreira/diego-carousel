# Plano v2 — Sistema de Carrosséis Diego Moreira, a partir do MVP entregue

## Contexto

O plano v1 (cópia em `docs/plano-v1.md`) foi entregue a um desenvolvedor, que implementou um
**MVP de copy pronta → ajuste visual → PNG** com um estúdio web local (relato em `docs/STATUS.md`).
Diego pediu uma revisão do estado atual e um novo plano a partir daqui. Objetivo: consolidar o que
existe, corrigir o que está fraco e completar a V1 (transcrição → tese → copy → design → PNG) sem
refazer o que já funciona.

Decisões de Diego nesta revisão (27/09):
- **Voz na copy pronta:** "você" vira aviso, não bloqueio; o sistema propõe a versão em "tu" lado a
  lado e só aplica com o aval dele (registrado em `approvals.json`).
- **Perfil (avatar + nome + selo) só na capa**, como nos publicados.
- **Ordem:** depois das correções, **motor editorial primeiro**; fidelidade visual e imagens depois.

## Diagnóstico do estado atual

Verificado: `npm run typecheck` limpo, 15 testes unitários passando, `carousel doctor` verde,
Chromium 1.63 instalado. **Nenhum commit no git** — todo o trabalho existe só no disco.

**Sólido — manter:**
- Fundação: TypeScript, Node 24 local ao projeto (sem mexer no global), Playwright fixado, zod 4 +
  JSON Schema gerado + exemplos, fontes Anton SC/Montserrat/Inter com hash, avatar do `.fig` com
  procedência.
- Contratos fiéis ao plano: `carousel.json` com todos os campos editoriais, `art-direction`,
  `tweaks`, manifesto de assets, IDs opacos, `schema_version`.
- Copy pronta: importa P1/Slide N/blocos do Figma, trava a copy (NFC + hash do arquivo bruto).
- Render: fontes carregadas com o texto real, `decode()`, sRGB, origem 127.0.0.1 com requests
  externos bloqueados, fit congelado em `fit/<id>.json`, pisos 36/52/58, CDP para fontes efetivas,
  console/requests, PNG 1080×1350 com sha256, render incremental por slide.
- Ordem garantida pelo CLI: `render` exige lint atual; `export` exige `validate` + revisão do render
  atual; `status` como livro-razão; variantes e `promote` com backup.
- Lint editorial e visual bem cobertos (8–12, capa sem body, rótulos, voz, expressões proibidas,
  duplicatas, `adds`, `next_question`, seções do relatório, órfãos, composições repetidas).
- Estúdio (127.0.0.1:4321) bem acabado: projetos, slides, grade, inspector, upload com direitos,
  versões, ZIP com confirmação, token + Origin + Host + revisão por hash, layout mobile.

**Bugs e riscos (corrigir antes de avançar):**
- **Salvar qualquer slide no estúdio apaga a exigência de imagem** (`workbench.js:39` envia
  `asset_id: null`; `api.ts:16` grava `need=false`) — fura o gate de export. Cada salvamento também
  grava todos os campos e move override de composição para `art-direction.json` (`api.ts:14,20`).
- **Hash de ambiente cobre `design/` e `engine/` inteiros** (`render.ts:15`), incluindo testes, UI,
  o avatar de 15 MB e `.DS_Store`: qualquer edição alheia invalida todos os renders e bloqueia o
  export; o polling de 12 s re-hasheia ~16 MB.
- **Gate de revisão fraco:** contador de ciclos nunca zera (trava após 3), `reviewer === 'Diego'`
  pula o limite (`render.ts:112-113`) e o estúdio grava "Diego" para qualquer clique (`server.ts:61`).
- **Quebra de linha:** a última linha custa 0 (`slide.js:21`), gerando viúvas sistemáticas
  ("…troca escuta por / defesa"). Medição por canvas, sem `balance`.
- **Escada de fit mente no log:** os estágios 3–4 só são rotulados (`slide.js:49`); o laço do piso
  encolhe headline e body juntos; `chars_that_fit` fica nulo quando não cabe.
- **Fonte de fallback não detectada:** o ✓ do selo (U+2713) está fora do `unicode-range`
  vendorizado e o CDP só olha `.text-line`.
- Estúdio: `/api/download` sem token; `/project/html/..%2Fcarousel.json` fura a lista de rotas
  estáticas (ainda dentro do projeto); ZIP e uploads originais servidos por rota estática; sem
  CSP/`frame-ancestors`; `localhost` responde 403; trava `busy` só no processo; `preview` com
  `projects/` vazio quebra `/api/state`; mobile com toast sobre o seletor e inspector fora da tela.
- Import: `P1 Headline` na mesma linha cai no modo blocos; formato Figma não carrega body com
  parágrafos; `copy.md` derivado não reimporta; CAIXA ALTA não vira ênfase; `**ênfase**` é removida.
- `asset add` troca a composição para `image_card` em silêncio (`assets.ts:19`); limite de 60 MP só
  checado no metadata; `$schema` só em `carousel.json` e com caminho errado nas variantes; quase
  todo `config.json` é ignorado (8–12 e 3 ciclos estão fixos no código); imports mortos em `cli.ts`.
- `test:studio` escreve em `projects/` e `fixtures/` reais; sem testes do quebrador de linhas,
  gates de fonte/404/console, rotas do servidor, goldens; fixtures 4 e 5 do plano não existem.

**Lacunas funcionais:**
1. **Base editorial rasa:** os 10 arquivos de `editorial/` têm 400–800 caracteres. O DNA da spec
   (papéis P1–P10, P1 outdoor, 10 famílias de hook, rubricas da Nota Viral com piso, 6 arquiteturas
   com mapa de painéis, famílias de headline, densidade, segunda virada, P9 reorganiza, P10 martelo,
   CTA, tom, contraste, metáforas, anti-padrões, resiliência de entrada) quase não foi transcrito, e
   `core-dna.md` desativa os frameworks próprios de Diego.
2. **Modo `full` inoperante:** `corpus:` lança erro; `new --source txt` cria 0 slides; não há
   `slide add`, gerador de IDs nem scaffold de direção de arte fora do import — o Claude teria de
   escrever todo JSON à mão; sem biblioteca genética, teste cego ou backlog.
3. **Fidelidade visual:** slides só-texto com ~600 px vazios embaixo; perfil em todos os internos;
   "Arrasta" centralizado + numeração; CTA do penúltimo sem ícone; capa A centralizada (real: embaixo
   à esquerda, sem rodapé); capa B com headline 96 px (real ~70); filete laranja do `quote`;
   composições por rotação mecânica; `giant_statement` igual a `minimal_pause`; til de "DISCUSSÃO"
   invadindo a linha de cima ("TODA" vira "TQDA") com entrelinha 1.04; sem calibração contra os PNGs.
4. **Imagens:** só upload manual; Higgsfield declarado sem login, ticket, download por URL, custo ou
   alternativas; Família A sem foto perde a identidade.
5. Ausentes do v1: `fit-probe`, `approvals.json`, `migrate`, `gallery`, `library ingest`, modos
   Instagram/safe area, inspector ao vivo, SSE, `sync_dir`, `.claude/launch.json`, contraste medido.

## Rodadas a partir daqui

### Rodada 0 — Linha de base e correções
- Commit inicial do estado atual (o `.gitignore` já exclui projetos e referências privadas), depois
  cada correção em commits pequenos.
- Hash de ambiente só do que afeta o pixel: runtime, CSS, tokens, fontes, avatar processado, versão
  do engine e do navegador.
- Estúdio salva só os campos alterados (patch por campo); nunca apaga `image.need`/`asset_id`.
- Gate de revisão: ciclos contados por `render_hash`, sem atalho por nome; revisor informado na tela.
- Quebra de linha: penalizar viúva na última linha; log da escada só com estágios executados; piso
  por bloco (body primeiro, headline por último); `chars_that_fit` sempre preenchido.
- Glifo ✓ desenhado em SVG; checagem de fallback em todo texto visível.
- Segurança do estúdio: token em `/api/download`, rotas estáticas por lista exata sem segmentos
  codificados, ZIP/uploads só por API, CSP + `frame-ancestors 'none'`, aceitar `localhost`, lockfile
  de render compartilhado com o CLI, primeiro uso com `projects/` vazio.
- Voz em copy pronta: "você" e "seu/sua" viram **aviso** no modo `design-only` (continua erro no
  `full`). A conversão com aval entra na Rodada 1.
- Perfil só na capa (`branding.profile_on: "cover"` em `config.json`).
- Import: marcador com headline na mesma linha, body com parágrafos no formato Figma, reimport do
  `copy.md`, CAIXA ALTA → ênfase; `asset add` não troca composição sozinho; ler `config.json` de verdade.
- Testes em diretório temporário; testes HTTP de Host/Origin/caminho; regressão do `asset_id`;
  testes do quebrador de linhas; avatar processado em 256 px; `.claude/launch.json`.

*Pronto quando:* `npm run check`, `test:e2e` e `test:studio` verdes sem tocar em `projects/` ou
`fixtures/`, e uma copy com "você" renderiza com avisos.

### Rodada 1 — Motor editorial (modo `full`)
- **Reescrever `editorial/*.md`** a partir da spec (§1–41, §88, §99), do perfil aprovado e do
  briefing: regras, exemplos bons e ruins e checklist por arquivo. Mantém "nunca inventar posição de
  Diego", mas reativa os frameworks dele como vocabulário disponível quando a fonte sustenta.
- **Fonte:** `new --source corpus:<id>` lê `transcricoes/<id>/v1.json` do disco (`texto`,
  `segmentos`, `palavras`; formato conferido) e recusa vídeos de supervisão/conversa; `.txt`
  continua aceito.
- **Rascunho estruturado:** `carousel draft <proj> <copy.md> --meta editorial.json` cria os slides
  com IDs opacos, funde tese/hooks/`next_question`/`adds` e gera direção de arte inicial **por
  função narrativa**; redraft preserva IDs; `slide add|move|rm` para ajustes estruturais.
- **Biblioteca genética semente:** Claude transcreve os 5 carrosséis de
  `references/diego/carousels` para `genetic-library/editorial/*.yaml` (tese, arquitetura, spine,
  bodies) e os limites do lint (faixa de body, pronomes) são calibrados nesses exemplos.
- **Teste cego de spine** por subagente (vê só as headlines e reconstrói a tese); backlog de teses
  em `ideas/backlog.jsonl`; checkpoint padrão após a tese nas primeiras semanas.
- **Conversão para "tu" com aval (design-only):** `carousel voice <proj>` gera
  `qa/voice-proposal.md` (original × proposta, só mudanças de pessoa verbal); `carousel approve
  <proj> voice` grava em `approvals.json` e aplica, mantendo a fonte original e o hash.
- SKILL.md com as fases 1–6 completas e os novos comandos.

*Pronto quando:* 3 transcrições (`~/Downloads/Texto colado.txt` + 2 vídeos públicos do Corpus)
viram carrosséis com lint limpo e teste cego aprovado, e Diego reconhece o DNA lendo as spines.

### Rodada 2 — Fidelidade visual
- Calibração contra 3 slides reais (capa e interno A de `post31:07`, interno B de `post7:7`):
  recriar com a mesma copy e imagem e comparar com `magick compare`; ajustar tokens.
- Rodapé: "Arrasta para o lado >" pequeno, cinza, à direita, sem numeração; CTA do penúltimo à
  direita com ícone vermelho; capa A embaixo à esquerda sem rodapé; capa B centralizada com
  headline ~70 px e só o cue.
- Composições: `text_only`/`quote`/`contrast` com bloco equilibrado verticalmente; sem filete
  decorativo por padrão; `giant_statement` de fato maior (fill); placeholder digno; estilo de ênfase
  por família.
- Mapa de tinta (acentos × linha anterior, sobreposição, área segura) — corrige o "TQDA" — e
  entrelinha da Família A de volta a ~0.9–0.95 quando o gate aprovar.
- `gallery` (todas as composições × famílias) para revisão rápida.

*Pronto quando:* diferença pequena nos 3 slides calibrados e um carrossel real de Diego (copy + fotos
dele) exportado sem ajuste fora do estúdio.

### Rodada 3 — Imagens
- Diego conecta o MCP Higgsfield (OAuth, `/mcp`).
- `asset request` monta o prompt canônico por família, a proporção, o negativo "sem texto", sem
  semelhança com pessoas reais e checa o teto de custo; o Claude gera; `asset add --request --url`
  baixa na hora e grava sha256 + request completo. O manifesto ganha `negative`, `seed`, `params`,
  `focal_point`, `score` e `rationale`.
- Capa com 3 variantes + `asset candidates` (folha com a headline real); foco acima do fade;
  gpt-image pelo próprio Higgsfield; seletor de alternativas no estúdio.

*Pronto quando:* um carrossel `full` sai com capa e imagens internas geradas, sem texto nas imagens.

### Rodada 4 — Fluxo e QA completos
`fit-probe` + troca automática de composição + compressão com `approvals.json`; `migrate`; estúdio
com modos Instagram/safe area, inspector ao vivo por CSS vars e SSE no lugar do polling; `sync_dir`
para o celular; contraste medido, dead space e monotonia; `npm run eval` com as 5 fixtures via
`claude -p`.

**Depois da V1:** biblioteca genética contínua, analytics (§77), terceira família ("Template Twitter").

## Verificação

- **A cada rodada:** `npm run check` (tsc + vitest), `npm run test:e2e`, `npm run test:studio`,
  `carousel doctor`, todos sem escrever em `projects/`/`fixtures/`.
- **Rodada 0:** teste de regressão prova que salvar um slide mantém `image.need`; editar um teste
  não invalida renders; copy com "você" renderiza com avisos; pedido HTTP com `..%2F` recebe 404.
- **Rodada 1:** `/diego-carousel` sobre `corpus:lE--NmXpw5o` ("Todo sarcástico é um invejoso
  assustado") → `editorial-report.md` completo, `carousel lint` limpo, teste cego registrado,
  `render` + `validate` verdes; `corpus:` de uma supervisão é recusado; `carousel voice` em uma copy
  com "você" gera proposta e só aplica após `approve`.
- **Rodada 2:** `magick compare` dos 3 slides calibrados dentro do limite combinado; mapa de tinta
  acusa o "TQDA" antes da correção e passa depois.
- **Rodada 3:** manifesto com request completo e sha256 de cada imagem gerada; folha de candidatos
  com 3 capas.
- **Fixtures (§94):** 1 = `~/Downloads/Texto colado.txt`; 2 e 3 = vídeos públicos do Corpus
  (diagnóstico denso e carência afetiva); 4 = um carrossel publicado transcrito no formato Figma;
  5 = copy sintética com bodies de 600+ caracteres.

## O que depende do Diego

- Avaliar as spines da Rodada 1 (checkpoint após a tese nas primeiras semanas).
- Indicar os carrosséis publicados que mais performaram (hoje são 5 em `references/`).
- Confirmar o enquadramento do avatar extraído do template.
- Login OAuth no Higgsfield na Rodada 3.
