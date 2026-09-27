---
name: diego-carousel
description: Transformar transcrições públicas de Diego Moreira em copy de carrossel e diagramar copy pronta com o engine local deste projeto. Usar também para revisar e renderizar um carrossel existente.
---

# Sistema de carrosséis Diego Moreira

Trabalhar na raiz do projeto. Ler `docs/STATUS.md` antes de escolher comandos: a V1 está em implementação. O plano em vigor é `docs/plano-v2.md`; a especificação original está em `docs/plano-v1.md`. Não confundir capacidade planejada com comando disponível.

## Modo e invariantes

- Transcrição pública: `full`. Fonte clínica de terceiros/supervisão não entra.
- Copy pronta: `design-only`, conteúdo travado. Importar, não reescrever.
- Ajuste visual: editar direção/tweaks por ID e renderizar novamente.
- Variante: `variant <projeto> <nome> --family <família>`, depois `render <projeto>/variants/<nome>`. Copy e assets permanecem no principal. `promote <projeto> <nome>` preserva o visual anterior antes de substituir a direção principal.
- Voz sempre tu, com conjugação coloquial. Ler `editorial/language-style.md`. Em copy pronta, "você" gera aviso (não bloqueio) e nunca é convertido sem aval de Diego.
- IDs opacos persistentes: nunca renumerar IDs junto com P1…Pn.
- `carousel.json` contém copy; `art-direction.json` contém decisões visuais; `tweaks.json` contém ajuste numérico.
- Fontes e assets locais. Nunca copiar `.env` ou credenciais.

## Copy pronta

1. `npm run carousel -- new <slug> --source copy`.
2. `npm run carousel -- import-copy <projeto> <arquivo>` aceita P1/Slide 1 e blocos do Figma.
3. Ler `visual/visual-dna.md`, `visual/compositions.md`, `visual/art-direction.md` e a família escolhida. Revisar a direção inicial, que é apenas uma alternância tipográfica.
4. Se necessário, registrar imagem com `asset add <projeto> <arquivo> --rights <origem> --slide <id>`; ler `visual/image-policy.md`.
5. Seguir render e revisão abaixo.

O log de fit (`run.log`, `fit/<id>.json`) lista só os estágios executados; `needs` indica se falta trocar composição ou comprimir, e `chars_that_fit` quanto do texto cabe. Não reduzir ou reescrever copy travada para caber. Reportar o problema. O fluxo de autorização/histórico de compressão ainda não existe; não contornar o gate alterando copy_locked ou a fonte original.

## Full editorial

1. Criar projeto com `new <slug> --source <transcricao.txt>`. Corpus direto ainda não implementado: usar uma exportação pública verificável.
2. Ler `editorial/core-dna.md` e `source-compression.md`. Produzir mapa com citações literais e falante no relatório.
3. Ler `thesis-selection.md`; levantar teses, escolher uma sustentada na fonte e registrar alternativas em `ideas/backlog.jsonl`. Nas primeiras rodadas editoriais, apresentar a tese para avaliação de Diego antes de desenvolver a copy.
4. Ler `hook-matrix.md` e `viral-score.md`; produzir 5–10 hooks e justificar escolha.
5. Ler `narrative-architectures.md`, `internal-headlines.md` e `continuity.md`; escrever spine, adds e next_question. Não afirmar que houve teste cego se não foi realizado.
6. Ler `language-style.md` e `editorial-qa.md`; escrever bodies e legenda, completar `carousel.json` conforme os schemas em `engine/schema/generated`. Relatório com Mapa da fonte, Diagnóstico, Teses, Hooks e Spine.
7. `lint <projeto>`; corrigir erros. Depois seguir direção de arte e render.

A biblioteca genética ainda não foi transcrita/calibrada. Não inventar exemplos como se fossem publicados por Diego.

## Render e revisão

- `render <projeto>` executa lint antes de renderizar. `--slides id,id` restringe a execução, mas validate continua exigindo todos os slides atuais.
- O engine salva candidatos em `qa/render`, fit em `fit/` e a grade em `qa/contact-sheet.png`.
- Se o texto não couber: examinar relatório, testar composição apropriada; compressão depende do modo e autorização. Nunca baixar fontes abaixo do piso.
- Ler `visual/visual-qa.md`; abrir a grade e todos os PNGs, conferir acentos e identidade. Corrigir a direção/tweaks com edições pontuais. Máximo de três ciclos.
- `validate <projeto>` verifica integridade atual. Após inspeção real, registrar `review <projeto> --reviewer Claude --note <observações> [--approved]`. Cada render novo revisado assim conta um ciclo automático; no limite de `config.json` pedir revisão humana. Nunca usar `--human` por conta própria.
- `export <projeto>` só libera PNGs e ZIP após validação e revisão atuais. `preview <projeto>` abre o estúdio local na porta 4321. A interface cria projetos por copy colada, ajusta visual, envia imagens, cria versões e registra revisão ao exportar. A copy permanece protegida.
- Não anunciar “publicável” se houver placeholder, conflito editorial, render antigo ou revisão pendente.

## Retomada

Rodar `status <projeto>`, ler run.log e os relatórios em qa. Manter a fonte original. Não reconstruir arquivos inteiros aprovados para uma mudança pequena. Pedidos ambíguos sobre “outra capa” exigem distinguir hook, imagem e estratégia.
