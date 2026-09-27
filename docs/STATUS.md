# Estado atual — 27/09/2026

Plano em vigor: `docs/plano-v2.md`. **Rodadas 0 a 4 implementadas; Rodada 5 (revisão para a execução
real) concluída na nuvem.** Engine 0.2.0. Da parte local já foram feitos o formato real do Corpus, a
biblioteca genética, a calibração das duas famílias e a faixa do body (seção abaixo).

**Não está concluído (sessão local, `docs/sessao-local.md`):** os três carrosséis `full` de verdade
(teste cego registrado e leitura de Diego), a fixture 4 (carrossel publicado em formato Figma), as
imagens reais pelo Higgsfield (o MCP precisa ser autorizado com `/mcp` numa sessão local), um
carrossel real de Diego exportado sem ajuste fora do estúdio e o `npm run eval` completo com os
vídeos escolhidos. Até lá, a V1 não pode ser declarada pronta pelos critérios do §93.

## Transcrição → carrossel pelo estúdio (agente editorial)

- **Novo → Da transcrição** (padrão): cola a transcrição ou informa o ID do Corpus. O estúdio cria o
  projeto e chama o **agente editorial**: o Claude Code do computador rodando a Skill sem conversa
  (`claude -p`, Bash só `npm run carousel`, edição só no projeto). **Novo → Copy pronta** continua.
- **Duas etapas com o checkpoint da tese** (`editorial.checkpoint_after_thesis`): a etapa 1 faz
  mapa, diagnóstico, teses e hooks e grava as opções (`thesis-options`, validadas); Diego escolhe a
  tese e o hook na tela (ou pede hooks novos para outra tese, com nota); a etapa 2 **retoma a mesma
  sessão do Claude** e vai da spine ao render com revisão automática. Sem checkpoint, etapa única.
- **Progresso no estúdio:** fases concluídas (lidas dos arquivos do projeto), atividade atual,
  registro (`qa/agent.log`), interromper e tentar de novo. O processo roda destacado: fechar o
  estúdio não para o agente; um processo morto aparece como erro, não como "rodando" para sempre.
- **CLI:** `agent start|choose|status|stop <projeto>`; `doctor` confere o Claude Code.
  `config.json` → `agent` (modelo, teto de gasto e tempo por etapa).
- **Testes:** um `claude` falso (`scripts/fake-claude.mjs`) no teste unitário e no E2E do estúdio
  (transcrição → teses → escolha na tela → slides); execução real do `claude -p` conferida na nuvem
  com uma transcrição sintética.

## Sessão local (27/09) — feito no Mac de Diego

- **Corpus:** formato real do `v1.json` (segmentos só com tempos; texto nas `palavras`) e catálogo
  lido de `corpus.db` (somente leitura). Uma supervisão e uma live recusadas; `lE--NmXpw5o` aceito.
- **Biblioteca genética:** cinco carrosséis publicados transcritos (post31:07, post7:7, post03:06,
  post18:05, post22:07), com ficha editorial e visual.
- **Calibração:** A = 78 px/1.10, B = 60 px/1.24, capa B 63 px/800; posições a ≤ 5 px dos
  publicados. Título preenchido que vaza a área segura tem o teto reduzido e refaz o fit.
- **Faixa do body:** 150–280 caracteres (publicados: 157–271, mediana 187).
- **Estúdio:** pasta de projetos atrás de symlink (macOS) resolvida.

## Rodada 5 — revisão para a execução real (nuvem)

- **Redraft e imagens:** o redraft casa cada painel pelo texto (id, título igual, título parecido;
  posição só com o mesmo número de painéis). Decisão explícita de imagem por slide
  (`image --need|--none`, "Exige imagem" no estúdio); placeholder bloqueia o export; a revisão pode
  ser registrada com imagens pendentes.
- **Composição:** `composition <projeto> <slide> <composição>` e o `autofit` usam a mesma regra
  (`switchComposition`), com posição do texto, ajuste do título, densidade e imagem coerentes. O
  `fit-probe` mede exatamente o que o `autofit` aplica; o `autofit` grava na direção de arte, mantém
  um slot de imagem quando algum cabe e avisa quando a imagem vira alternativa. Composição de texto
  que ainda exige imagem é erro no lint, é recusada no estúdio e aparece no `migrate`; o
  `composition` avisa na hora quando cria três composições iguais seguidas.
- **Pedidos de imagem:** sem cena, o pedido é recusado; cena, mood ou sujeito em português geram
  aviso (o prompt canônico é em inglês). A fixture modelo do modo full traz `visual_intent`.
- **Status:** `next` segue as fases do modo full (seção do relatório que falta, depois o teste cego),
  mostra `auto_review_cycles_left` e, esgotados os ciclos, aponta a revisão de Diego no estúdio.
- **Locks:** lock abandonado só é recuperado sob uma guarda exclusiva (`.lock.reclaim`); antes, dois
  processos disputando o mesmo lock morto podiam entrar juntos (teste com 40 rodadas). Propostas,
  assets, pedidos e revisões gravam com o projeto travado.
- **Estúdio:** aprovação de proposta presa ao hash do texto mostrado; eventos e atualização cobrem
  revisões e propostas; espaçamento padrão da família no inspector; trocar a composição ajusta
  posição, ajuste do título e "Exige imagem".
- **Copy e fontes:** meta parcial não apaga a tese no redraft; copy travada pela 0.1.0 é conferida
  com o parser que a travou; visibilidade desconhecida no Corpus exige `--confirm-public`; a recusa
  por conversa diz o motivo (outro falante, live ou só uma palavra no título); siglas conhecidas
  (TDAH, QI…) não viram ênfase.
- **Render:** hash de ambiente com a versão do Chromium; texto de placeholder fora da checagem de
  fonte fallback; título preenchido não deixa palavra sozinha na linha; texto do `image_card` logo
  acima do card; falha do mapa de tinta medida duas vezes antes de reprovar; um navegador por
  `fit-probe` e por folha de candidatas.
- **Simulação pelo CLI:** um carrossel `full` com a fixture sintética passou por todo o fluxo
  (`new` → relatório → `draft` → `spine --blind` → `lint` → `render` → `asset request`/`add` →
  `candidates` → `composition` → `review` → `export`). O relatório e a copy vieram da fixture; o
  teste cego não foi feito por subagente. Os atritos encontrados viraram as correções acima.
- **Testes:** 74 unitários, E2E de render e E2E do estúdio verdes na nuvem.

## Rodada 4 — fluxo e QA completos

- `fit-probe` (composições que cabem, tamanhos, palavras a cortar) e `autofit` (troca automática de
  composição; desde a Rodada 5 grava na direção de arte). Copy pronta: `edit` → proposta →
  `approve edit` (cadeia em `approvals.json`); o estúdio mostra propostas pendentes e aprova na tela.
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
- Mapa de tinta: acentos/cedilhas que colidem ganham espaço só naquela linha; título preenchido que
  vaza da área segura tem o teto reduzido e refaz o fit.
- `gallery` (vocabulário completo) e `calibrate` (render × PNG publicado, com folha de diferença).
- Calibrado localmente em 27/09 contra `post31:07` (capa e interno) e `post7:7` (capa e interno com
  card): A = 78 px/1.10, B = 60 px/1.24, capa B 63 px/800; posições a ≤ 5 px do publicado.

## Rodada 1 — motor editorial (nuvem)

- `editorial/` reescrito a partir da especificação: papéis P1–P10, cinco arquiteturas, dez famílias
  de hook, Nota Viral com piso (impacto, clareza, tensão), famílias de headline, densidade, spine e
  teste cego, continuidade (`next_question`, `adds`, anti-filler, segunda virada), tom, contraste,
  metáfora, CTA, anti-padrões. Frameworks de Diego são vocabulário quando a fonte sustenta.
- `new --source corpus:<id>` (ou um `v1.json`): lê a transcrição do Corpus, mantém tempo e falante
  na transcrição de trabalho, recusa supervisão e conversa. Formato real conferido na sessão local.
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
  compositor, branding, versão do Playwright e do Chromium). Editar testes ou a UI não
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
  `/api/download`, ZIP e uploads só pela API, CSP (hoje `frame-ancestors 'self'`, pela prévia ao
  vivo), `localhost`
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

# Relato do MVP de copy pronta — 27/09/2026 (histórico)

Registro do primeiro recorte. O que está "adiado" abaixo foi feito nas Rodadas 1–5, exceto o que
depende da sessão local (topo deste arquivo).

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
