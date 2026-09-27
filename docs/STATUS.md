# MVP de copy pronta — 27/09/2026

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
