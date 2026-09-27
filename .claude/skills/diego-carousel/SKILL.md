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

## Autonomia e checkpoints

Padrão `autonomy: full`: seguir as fases sem pedir aprovação, exceto o checkpoint da tese enquanto
`editorial.checkpoint_after_thesis` for `true`. Com `approval_mode: true` (ou "com aprovação" no
pedido), parar em três pontos: (1) tese + hooks, (2) copy completa, (3) preview aberto.

## Modo full — Fases 1 a 6 (editorial)

**Fase 1 — Fonte e mapa.** Ler `editorial/core-dna.md` e `editorial/source-compression.md`.
- `new <slug> --source corpus:<video_id>` (lê `transcricoes/<id>/v1.json` do disco; defina
  `CAROUSEL_CORPUS_DIR` se o Corpus não estiver no caminho padrão) ou `--source <arquivo.txt>`.
  Sem acesso ao disco mas com o MCP `corpus-diego`: obter a transcrição pelo MCP, salvar o JSON
  como `v1.json` e usar `--source <v1.json>`. O engine recusa supervisão, conversa, live, vídeo
  privado ou não listado (`--allow-unlisted` só com aval de Diego); fonte sem registro no Corpus
  exige conferir pelo MCP que é vídeo público de Diego e repetir com `--confirm-public`.
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
`continuity.md` e 2–3 exemplos publicados: `library list --architecture <arquitetura>` (ou
`--family`) mostra tese e spine de cada um; ler o YAML completo em `genetic-library/editorial/` e as
`notes`, que dizem o que o exemplo ensina e o que evitar. Os publicados misturam "você" e "teu":
a regra atual é sempre "tu". Escrever só as headlines + `next_question` + `adds`. Registrar em
`## Spine`.
**Teste cego:** depois do draft (Fase 5), rodar `spine <projeto> --blind` e passar SÓ essa saída a
um subagente com a pergunta: "Qual é a tese em uma frase? O argumento avança a cada painel? Qual
painel sobra?". Registrar a resposta literal, a comparação com a tese e o veredito em
`## Teste cego`. Se não bater, corrigir a spine antes dos bodies. Nunca inventar o resultado.

**Fase 5 — Bodies e estrutura.** `language-style.md`. Escrever `copy.md` (formato P1…Pn) e um
`editorial.json` com `editorial` (briefing, tese, hook, candidatos, CTA, legenda), `art` (família,
racional) e `slides[]` (`narrative_role`, `headline_type`, `adds`, `next_question`,
`visual_intent`) na mesma ordem. Modelo: `fixtures/full/editorial.json`; contrato:
`engine/schema/generated/editorial-meta.schema.json`. Então:
```
draft <projeto> copy.md --meta editorial.json      # cria slides, IDs e direção inicial por função
```
Redraft casa cada painel com o slide anterior pelo texto (título igual ou parecido; mesma posição só
quando o número de painéis não mudou), então direção de arte e imagem seguem o texto; painel novo
ganha ID novo. `--reset-art` refaz a direção. Ajustes estruturais: `slide add|move|rm`.

**Fase 6 — QA editorial.** `editorial-qa.md` + `lint <projeto>`. Corrigir todos os erros; ler os
avisos. Passar no lint não prova qualidade: fazer a leitura do checklist.

## Fases 7 a 10 (visual) — full e design-only

**Fase 7 — Direção de arte.** `visual/visual-dna.md`, `compositions.md`, `art-direction.md` e o
arquivo da família. Revisar a direção inicial do draft/import: família (heurística em
`art-direction.md`), composição por função, densidade (nunca todos HIGH), ritmo, conceito de
imagem por slide (`image.concept`, `mood`, `negative_space`, `focal_point`).
Trocar composição sempre com `composition <projeto> <slide-id> <composição>`: grava posição do
texto, ajuste do título, densidade e imagem coerentes (composição de texto guarda a imagem como
alternativa; `cinematic_fade`/`image_card` sem imagem viram placeholder declarado). Nunca editar só
o campo `composition` à mão.

**Fase 8 — Assets.** `visual/image-policy.md` e a ficha do provider em `visual/providers/`.
Prioridade: fornecido por Diego → biblioteca → frame do próprio vídeo (`asset frame <projeto>
<video> --at mm:ss --slide <id>`) → licenciado → gerado. Registrar arquivo com
`asset add <projeto> <arquivo> --rights <origem> --slide <id>`.
Para gerar: `asset request <projeto> <slide-id> [--concept "…"]` (prompt canônico, negativo, tamanho,
3 variantes na capa, teto de gerações) → gerar com o MCP do provider usando exatamente o prompt do
pedido → conferir cada imagem (sem texto, sem pessoa real) → registrar na hora com
`asset add <projeto> --request <pedido> --url <url> [--model …] [--seed …]`. Escolher entre as
variantes com `asset candidates <projeto> <slide-id>` (abrir `qa/candidates/<slide>.png`) e
`asset choose <projeto> <slide-id> <asset-id> --score n --rationale "…"`. Sem imagem, fica
placeholder e o export espera. Se Diego decidir que um slide não usa imagem:
`composition <projeto> <slide-id> text_only` (ou outra de texto). Uma capa `full_bleed` sem imagem
vira capa tipográfica: `image <projeto> <slide-id> --none` (`--need` volta a exigir).

**Fase 9 — Render e QA visual.** `render <projeto>` (exige lint limpo). Abrir
`qa/contact-sheet.png`, TODOS os PNGs de `qa/render/` e os mapas de tinta de `qa/ink/`; ler os
avisos do render (tinta, contraste, espaço vazio, ritmo) e comparar com a direção de arte
(`visual/visual-qa.md`). Se algo não cabe: `fit-probe <projeto> <slide-id>` mostra que composições
cabem e quanto cortar; `autofit <projeto>` troca a composição dos que não cabem (na direção de
arte, pela mesma regra do `composition`; mantém um slot de imagem quando algum cabe, senão avisa que
a imagem virou alternativa) e renderiza. Se ainda assim não couber: em `full`, comprimir a copy (redraft); em `design-only`,
`edit <projeto> <slide-id> --body "…" --reason "…"` gera `qa/edit-proposal.md` e só entra com
`approve <projeto> edit --by Diego` depois do aval dele. Nunca descer abaixo dos pisos. Registrar
cada inspeção real: `review <projeto> --reviewer Claude --note "<o que vi>" [--approved]` (ciclo
automático; `status` mostra `auto_review_cycles_left`). Esgotados os ciclos, a próxima revisão é
de Diego no estúdio: avisar e parar. Nunca usar `--human`. Com imagens ainda pendentes a revisão
pode ser registrada (fica marcada); o export continua esperando as imagens e uma nova revisão do
render final.

**Fase 10 — Export e preview.** `validate` → `export` (copia também para `export.sync_dir`, se
configurado). `preview <projeto>` abre o estúdio em 127.0.0.1:4321: ajuste com prévia ao vivo,
visão Instagram (com o recorte 3:4 da grade), área segura, versões e exportação (que registra a
revisão humana). Não chamar de "publicável" com placeholder, lint com erro, render antigo ou revisão
pendente.

## Copy pronta (design-only)

1. `new <slug> --source copy` e `import-copy <projeto> <copy.md>` (ou `from-copy <slug> <copy.md>`).
   Aceita P1/Slide 1/formato Figma; CAIXA ALTA vira ênfase (siglas conhecidas como TDAH e QI não;
   para destacar uma sigla, `**TDAH**`).
2. Se houver "você": `voice <projeto>` gera `qa/voice-proposal.md`. Mostrar a Diego. Só depois do
   "aprovado" explícito dele: `approve <projeto> voice --by Diego`. Mudanças fora da regra bloqueiam.
3. Seguir as Fases 7–10. Não reescrever copy travada para caber: reportar.

## Ajustes (rerender) e variantes

- Ajuste pontual: editar `tweaks.json` (`slides.<id>.params`) ou o campo certo de
  `art-direction.json`, depois `render <projeto>`; só o slide afetado muda.
- Variante: `variant <projeto> <nome> --family <família>` → `render <projeto>/variants/<nome>`;
  `promote <projeto> <nome>` guarda o visual anterior como backup.

## Manutenção

- Projeto de versão antiga do engine: `migrate <projeto>` (ou `migrate --all`).
- Vocabulário visual inteiro: `gallery [--image foto.jpg]` → `gallery/gallery.png`.
- Fidelidade aos publicados: `calibrate <projeto> --slide n --ref <png publicado>`.
- Fixtures de aceite: `npm run eval -- --dry-run`, `--engine-only` ou completo (local, via `claude -p`).

## Retomada

`status <projeto>` diz o que está atual para o conteúdo de agora e o próximo passo (`next`);
depois `run.log` e `qa/*.json`. Manter a fonte original. Não reconstruir arquivos aprovados para uma
mudança pequena.
