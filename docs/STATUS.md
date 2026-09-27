# Estado atual — 27/09/2026

Plano em vigor: `docs/plano-v2.md`. **Rodada 0 (linha de base e correções) concluída.**
Próxima: Rodada 1, motor editorial (modo `full`).

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
