# Estado atual — 27/09/2026

Plano em vigor: `docs/plano-v2.md`. **Rodadas 0 a 4 implementadas e testadas na nuvem.** O que
depende do Corpus, das referências privadas, do `~/Downloads` e do login no Higgsfield está em
`docs/sessao-local.md`, com os prompts para rodar. Engine 0.2.0.

**Não está concluído (depende da sessão local):** conferir o formato real do Corpus, semear a
biblioteca genética, os três carrosséis `full` de verdade com teste cego e a leitura de Diego,
calibrar os tokens contra os PNGs publicados, gerar imagens reais pelo Higgsfield e rodar
`npm run eval` completo. Até lá, a V1 não pode ser declarada pronta pelos critérios do §93.

## Rodada 4 — fluxo e QA completos

- `fit-probe` (composições que cabem, tamanhos, palavras a cortar) e `autofit` (troca automática de
  composição como tweak). Copy pronta: `edit` → proposta → `approve edit` (cadeia em
  `approvals.json`); o estúdio mostra propostas pendentes e aprova na tela.
- Métricas de revisão: contraste medido sob título e body, maior faixa vazia, ritmo do carrossel.
- `migrate` (projetos antigos), `export.sync_dir` (espelho do export para o celular).
- Estúdio: prévia ao vivo no inspector, visão Instagram (com recorte 3:4 da grade), área segura,
  eventos do servidor (SSE) no lugar do polling, criação a partir do estúdio vazio.
- `npm run eval` com as 5 fixtures do §94 (`fixtures/eval.json`).

## Rodada 3 — imagens

- `asset request` (ticket com prompt canônico por família/composição, negativo, tamanho do slot,
  variantes, teto de gerações) → gerar pelo MCP → `asset add --request --url` (download imediato,
  sha256, pedido completo no manifesto). Alternativas por slide, `asset candidates` (folha com o
  título real), `asset choose` (nota e justificativa), `asset frame` (frame do próprio vídeo).
- Manifesto com negative/seed/params/request_id/source_url/score/rationale.

## Rodada 2 — fidelidade visual

- Tokens por família (`design/tokens.json`) e CSS reescrito sem números mágicos.
- Rodapé sem numeração (pílula + cue pequeno à direita; CTA do penúltimo com ícone vermelho; nada no
  último). Capa A embaixo à esquerda sem rodapé; capa B centralizada com o cue. Perfil só na capa.
- Composições equilibradas; `quote` sem filete; `giant_statement` preenche; placeholder digno;
  ênfase por família.
- Mapa de tinta: acentos/cedilhas que colidem ganham espaço só naquela linha; Família A em 0.92.
- `gallery` (vocabulário completo) e `calibrate` (render × PNG publicado, com folha de diferença).
- **Pendente (local):** calibração contra `post31:07` e `post7:7`.

## Rodada 1 — motor editorial (nuvem)

- `editorial/` reescrito a partir da especificação: papéis P1–P10, cinco arquiteturas, dez famílias
  de hook, Nota Viral com piso (impacto, clareza, tensão), famílias de headline, densidade, spine e
  teste cego, continuidade (`next_question`, `adds`, anti-filler, segunda virada), tom, contraste,
  metáfora, CTA, anti-padrões. Frameworks de Diego são vocabulário quando a fonte sustenta.
- `new --source corpus:<id>` (ou um `v1.json`): lê a transcrição do Corpus, mantém tempo e falante
  na transcrição de trabalho, recusa supervisão e conversa. **Formato real ainda a conferir.**
- `draft <proj> copy.md --meta editorial.json`: slides com IDs opacos, metadados editoriais e
  direção de arte inicial por função narrativa; redraft preserva IDs. `slide add|move|rm`.
- `voice` / `approve <proj> voice --by`: proposta "você → tu" só com mudanças de pessoa; aplicada
  com aval registrado em `approvals.json`; o lint confere a cadeia fonte → aprovações.
- Lint do modo full: seções do relatório (inclui `## Teste cego`), briefing, hook com piso,
  5+ candidatos, vocabulários de papel/headline/adds. Faixa do body em `config.json`.
- `idea add|list` (backlog), `spine --blind`, `library validate|stats` (biblioteca genética em YAML),
  checkpoint após a tese em `config.json`.
- Skill reescrita com as Fases 1–10, modos e comandos.
- Testes: 44 unitários; E2E cobre o fluxo full (Corpus sintético → draft → render → export
  bloqueado pelas imagens pendentes).

## Rodada 0 — o que mudou

- **Estúdio:** salvar envia só os campos tocados; tirar a imagem de um slide que precisa de
  imagem volta a ser placeholder (o gate de export continua valendo). Composição escolhida no
  estúdio vai para `tweaks.json`, não reescreve a direção de arte.
- **Hash de ambiente:** só o que chega ao pixel (runtime, CSS, tokens, fontes, avatar processado,
  compositor, branding, versão do Playwright e caminho do Chromium). Editar testes ou a UI não
  invalida renders.
- **Revisão:** ciclos automáticos contados por render distinto desde a última revisão humana
  (limite em `config.json`); nome do revisor não dá atalho. `review --human` e o estúdio (que
  pergunta quem revisou) registram revisão humana.
- **Quebra de linha** (`design/runtime/linebreak.js`, testada em Node): menor número de linhas,
  sem viúva, sem linha terminando em palavra curta de ligação, títulos equilibrados.
- **Fit:** o log lista só estágios executados; o body encolhe até o piso antes do título;
  reprovação registra `needs` e `chars_that_fit` de cada bloco.
- **Fontes:** selo ✓ desenhado em SVG; detecção de fonte fallback em todo elemento com texto.
- **Servidor:** rotas estáticas por lista exata (sem segmentos codificados), token em
  `/api/download`, ZIP e uploads só pela API, CSP com `frame-ancestors 'none'`, `localhost`
  aceito, lock de projeto compartilhado com o CLI, estúdio abre com `projects/` vazio.
- **Voz:** "você" em copy pronta é aviso; continua erro no modo `full`.
- **Perfil só na capa** (`branding.profile_on: "cover"`).
- **Import:** `P1 Título` na mesma linha; formato Figma com parágrafos (painéis separados por
  duas linhas em branco); `copy.md` com marcadores reimporta igual; CAIXA ALTA em texto misto
  vira ênfase e `**ênfase**` é desenhada (cor) em vez de removida.
- `asset add` não troca composição sozinho (avisa); limite de 60 MP aplicado na decodificação;
  `$schema` correto em todos os documentos, inclusive variantes; `config.json` validado e lido
  (faixa de painéis, ciclos, branding).
- Avatar processado em 256 px (`npm run brand`); `.claude/launch.json` para o estúdio; hook de
  SessionStart para a nuvem (`CAROUSEL_CHROMIUM`).
- **Testes:** 29 unitários (quebrador de linhas, hash de ambiente, regressão do `asset_id`, import,
  voz); E2E cobre ciclos de revisão e fonte fallback; estúdio E2E cobre Host, `localhost`,
  traversal, `..%2F`, ZIP estático, token do download e CSP — tudo em diretório temporário.
- Fixture 5 (`fixtures/copy-excessiva.md`, bodies de 600+ caracteres). A fixture 4 depende de um
  carrossel publicado de `references/` (privado, fora do Git).

## Ainda pendente da Rodada 0

Nada bloqueante. `design/brand/avatar-source.png` (15 MB) continua versionado como procedência;
o render usa só `avatar.png`.

---

# Relato do MVP de copy pronta — 27/09/2026

## Escopo fechado nesta rodada

Por orientação de Diego, priorizamos o fluxo utilizável e deixamos os requisitos
mais trabalhosos para depois. **Este é o MVP de copy pronta → ajuste visual →
PNG. Não é a V1 completa de transcrição → decisão editorial → carrossel.**

### O que funciona pela tela

- Criar projeto colando 8–12 painéis, no formato P1/Slide 1 ou no formato Figma.
- Alternar entre projetos, navegar pelos slides ou ver a grade.
- Escolher entre duas famílias e oito composições.
- Ajustar tamanho de título/corpo, espaçamento, alinhamento e posição.
- Enviar PNG/JPEG/WebP com origem registrada, escolher imagem e ajustar foco/zoom.
- Salvar e renderizar novamente; PNGs dos slides não afetados ficam preservados.
- Criar versões visuais sem duplicar ou modificar a copy. Tornar uma versão
  principal preservando o visual anterior em uma versão de backup.
- Conferir, aprovar e baixar um ZIP com os PNGs numerados em 1080×1350.
- Usar a interface no desktop ou em tela pequena.

### Proteções mantidas

- Copy comparada com a fonte original; arquivo bruto e hash preservados.
- Pisos tipográficos, encaixe de texto, margens, fontes usadas via CDP,
  carregamento, erros de console, integridade dos arquivos e render atual.
- Imagem necessária ausente impede exportar. Exportação exige revisão visual.
- Escrita da interface exige token de sessão, origem local e revisão atual do
  projeto. Alterações concorrentes conhecidas são recusadas para recarregar.
- O servidor escuta somente 127.0.0.1. O modo interno de render é somente leitura.
- O ZIP contém só PNGs. A exportação anterior fica guardada em qa.

## Verificação

- TypeScript sem erros e 15 testes unitários aprovados.
- Testes do renderer: duas famílias, oito composições, overflow sem reescrita,
  integridade dos PNGs, revisão obrigatória e rerender isolado.
- Teste da interface em Chromium: navegar, salvar ajuste, preservar copy,
  criar versão, recusar escrita sem token e revisão antiga, aprovar export,
  baixar e verificar CRC/conteúdo do ZIP, criar projeto pela tela e enviar foto.
- Capturas de desktop e mobile em `fixtures/studio-desktop.png` e
  `fixtures/studio-mobile.png`. A copy das fixtures é sintética.

## Como abrir

```sh
npm run preview -- projects/2026-09-27-demonstracao
```

Acessar http://127.0.0.1:4321. Usar **Novo** para colar outra copy.
Selecionar projetos no topo. O botão **Exportar PNGs** pede confirmação da
revisão visual, executa os gates e baixa o ZIP.

Para trabalhar sem a interface:

```sh
npm run carousel -- from-copy meu-post copy.md
npm run carousel -- variant <projeto> cinematica --family cinematic_condensed
npm run carousel -- render <projeto>/variants/cinematica
npm run carousel -- promote <projeto> cinematica
```

## Adiado intencionalmente

- Integração Corpus e busca de transcrições: não implementadas.
- Higgsfield/OAuth, geração de imagens e teto de custo: não conectados.
- Calibração pixel a pixel com o Figma, mapa de tinta/acentos, contraste
  medido e goldens completos: mantemos medidas aproximadas e inspeção visual.
- Ajuste automático por composição alternativa e compressão editorial:
  o editor permite trocar a composição; não corta nem reescreve copy.
- Biblioteca genética transcrita, avaliação editorial de três fontes reais
  e teste cego de spine: pendentes. Guias editoriais e Skill existem.
- Inspector com mudança instantânea antes de salvar: o MVP mostra o render
  real depois de salvar. Alterações externas são consultadas a cada 12 segundos.
- Métricas, análises de desempenho, sincronização em nuvem, migrações e
  edição estrutural de copy aprovada: fora deste recorte.

## Limitações práticas

Copy com voz proibida ou fora de 8–12 painéis pode ser salva como projeto,
mas não será liberada pelo lint. O editor mostra os erros; não reescreve texto.
Usar um novo projeto para uma nova copy. Se algo não couber, ajustar layout e
espaçamento ou revisar editorialmente fora deste fluxo antes de reimportar.

Os arquivos originais em `references/diego` e projetos ficam fora do Git.
O avatar foi extraído do template fornecido. Node 24 é local ao projeto,
sem alteração da instalação global. Variantes guardam apenas direção e
ajustes; conteúdo e biblioteca de imagens são lidos do projeto principal.
