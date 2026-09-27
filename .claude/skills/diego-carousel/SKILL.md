---
name: diego-carousel
description: Transformar transcrições públicas de Diego Moreira (arquivo ou Corpus) em carrossel de Instagram completo — tese, copy, direção de arte e PNGs — e diagramar copy pronta com o engine local deste projeto. Usar também para ajustar, variar, revisar e exportar um carrossel existente.
---

# Sistema de carrosséis Diego Moreira

Trabalhar na raiz do projeto. Plano em vigor: `docs/plano-v2.md`; estado: `docs/STATUS.md`.
Não confundir capacidade planejada com comando disponível: `npm run carousel -- help` lista o que
existe. Todo comando abaixo é `npm run carousel -- <comando>`.

## Detectar o modo

| Pedido | Modo | Começa em |
|---|---|---|
| transcrição (.txt), vídeo do Corpus (`corpus:<id>`), "faz um carrossel deste vídeo" | `full` | Fase 1 |
| copy P1–P10 pronta (do agente de copy ou colada) | `design-only` | Copy pronta |
| "aumenta o título do 4", "troca a imagem", "move o texto" em projeto existente | `rerender` | Ajustes |
| "faz no estilo B", "outra capa" | `variant` | Variantes |

"Outra capa" é ambíguo (outro hook? outra imagem? outra estratégia?): perguntar antes.

## Invariantes

- Voz sempre "tu" (`editorial/language-style.md`). Em copy pronta, "você" é aviso e só muda com
  aval de Diego.
- Uma tese por carrossel. Nunca inventar posição de Diego. Só fonte pública com falante Diego:
  supervisões, conversas e casos de terceiros nunca entram.
- IDs de slide são opacos e persistentes: nunca renumerar. `carousel.json` = conteúdo;
  `art-direction.json` = decisões visuais; `tweaks.json` = ajuste numérico; `approvals.json` = o que
  Diego aprovou (gravado pelo CLI).
- Depois de aprovado, editar arquivos com mudanças pontuais; nunca reescrever o arquivo inteiro.
- Nunca mexer em `copy_locked`, `source/` ou `approvals.json` para contornar o lint.
- Fontes e assets locais. Nunca copiar `.env` ou credenciais.

## Modo full — Fases 1 a 6 (editorial)

**Fase 1 — Fonte e mapa.** Ler `editorial/core-dna.md` e `editorial/source-compression.md`.
- `new <slug> --source corpus:<video_id>` (lê `transcricoes/<id>/v1.json` do disco; defina
  `CAROUSEL_CORPUS_DIR` se o Corpus não estiver no caminho padrão) ou `--source <arquivo.txt>`.
  Sem acesso ao disco mas com o MCP `corpus-diego`: obter a transcrição pelo MCP, salvar o JSON
  como `v1.json` e usar `--source <v1.json>`. Supervisão/conversa é recusada pelo engine.
- Ler `source/transcript.txt` uma vez (tem `[m:ss] (falante)`); escrever `## Mapa da fonte` em
  `editorial-report.md` com citação literal e localização por ideia. Daqui em diante trabalhar
  sobre o mapa.

**Fase 2 — Diagnóstico e tese.** `editorial/thesis-selection.md`. Escrever `## Diagnóstico` (cinco
campos) e `## Teses` (3–6 candidatas, seis implicações cada). Com o MCP: `consultar_corpus`
(falante = Diego) para checar defensabilidade e achar formulações próprias. Escolher UMA; as outras
vão para o backlog com `idea add --thesis … --source corpus:<id> --why …`.
**Checkpoint:** se `config.json` → `editorial.checkpoint_after_thesis` for `true` (padrão agora),
apresentar a tese escolhida, duas alternativas e 3 hooks e esperar Diego escolher.

**Fase 3 — Hooks.** `editorial/hook-matrix.md` e `viral-score.md`. 5–10 hooks de famílias
diferentes, notas nas seis dimensões, piso 7 em impacto/clareza/tensão, escolha por curiosidade +
defensabilidade + progressão. Registrar em `## Hooks`.

**Fase 4 — Arquitetura e spine.** `narrative-architectures.md`, `internal-headlines.md`,
`continuity.md` e, quando existir, 2–3 exemplos de `genetic-library/editorial/`. Escrever só as
headlines + `next_question` + `adds`. Registrar em `## Spine`.
**Teste cego:** depois do draft (Fase 5), rodar `spine <projeto> --blind` e passar SÓ essa saída a
um subagente com a pergunta: "Qual é a tese em uma frase? O argumento avança a cada painel? Qual
painel sobra?". Registrar a resposta literal, a comparação com a tese e o veredito em
`## Teste cego`. Se não bater, corrigir a spine antes dos bodies. Nunca inventar o resultado.

**Fase 5 — Bodies e estrutura.** `language-style.md`. Escrever `copy.md` (formato P1…Pn) e um
`editorial.json` com `editorial` (briefing, tese, hook, candidatos, CTA, legenda), `art` (família,
racional) e `slides[]` (`narrative_role`, `headline_type`, `adds`, `next_question`,
`visual_intent`) na mesma ordem. Modelo: `fixtures/full/editorial.json`. Então:
```
draft <projeto> copy.md --meta editorial.json      # cria slides, IDs e direção inicial por função
```
Redraft preserva IDs e direção de arte; `--reset-art` refaz a direção. Ajustes estruturais:
`slide add|move|rm`.

**Fase 6 — QA editorial.** `editorial-qa.md` + `lint <projeto>`. Corrigir todos os erros; ler os
avisos. Passar no lint não prova qualidade: fazer a leitura do checklist.

## Fases 7 a 10 (visual) — full e design-only

**Fase 7 — Direção de arte.** `visual/visual-dna.md`, `compositions.md`, `art-direction.md` e o
arquivo da família. Revisar a direção inicial do draft/import: família (heurística em
`art-direction.md`), composição por função, densidade (nunca todos HIGH), ritmo, conceito de
imagem por slide (`image.concept`, `mood`, `negative_space`, `focal_point`).

**Fase 8 — Assets.** `visual/image-policy.md`. Prioridade: fornecido por Diego → biblioteca →
frame do próprio vídeo → licenciado → gerado. Registrar com
`asset add <projeto> <arquivo> --rights <origem> --slide <id>`. Sem imagem, fica placeholder e o
export espera.

**Fase 9 — Render e QA visual.** `render <projeto>` (exige lint limpo). Abrir
`qa/contact-sheet.png` e TODOS os PNGs de `qa/render/`; comparar com a direção de arte
(`visual/visual-qa.md`). Se algo não cabe: `fit/<id>.json` → `needs` diz se falta trocar
composição ou comprimir; `chars_that_fit` diz quanto cabe. Em `full`, comprimir a copy; em
`design-only`, só com autorização. Nunca descer abaixo dos pisos. Corrigir com edições pontuais e
renderizar de novo. Registrar cada inspeção real:
`review <projeto> --reviewer Claude --note "<o que vi>" [--approved]` (ciclo automático; no limite
de `config.json` a revisão passa a ser humana). Nunca usar `--human`.

**Fase 10 — Export e preview.** `validate` → `export`. `preview <projeto>` abre o estúdio em
127.0.0.1:4321, onde Diego ajusta, cria versões e exporta (a exportação pelo estúdio registra a
revisão humana). Não chamar de "publicável" com placeholder, lint com erro, render antigo ou
revisão pendente.

## Copy pronta (design-only)

1. `new <slug> --source copy` e `import-copy <projeto> <copy.md>` (ou `from-copy <slug> <copy.md>`).
   Aceita P1/Slide 1/formato Figma; CAIXA ALTA vira ênfase.
2. Se houver "você": `voice <projeto>` gera `qa/voice-proposal.md`. Mostrar a Diego. Só depois do
   "aprovado" explícito dele: `approve <projeto> voice --by Diego`. Mudanças fora da regra bloqueiam.
3. Seguir as Fases 7–10. Não reescrever copy travada para caber: reportar.

## Ajustes (rerender) e variantes

- Ajuste pontual: editar `tweaks.json` (`slides.<id>.params`) ou o campo certo de
  `art-direction.json`, depois `render <projeto>`; só o slide afetado muda.
- Variante: `variant <projeto> <nome> --family <família>` → `render <projeto>/variants/<nome>`;
  `promote <projeto> <nome>` guarda o visual anterior como backup.

## Retomada

`status <projeto>`, `run.log`, `qa/*.json`. Manter a fonte original. Não reconstruir arquivos
aprovados para uma mudança pequena.
