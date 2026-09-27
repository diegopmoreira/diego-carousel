# Imagens

## O processo de Diego: cenas de filme que o público reconhece (estratégia principal)

É assim que os carrosséis de melhor desempenho foram ilustrados (`post10:03`, O Show de Truman;
`post30:03`, A Substância — ver `genetic-library/`). Para cada slot de imagem, a direção de arte
propõe **cenas de filmes ou séries** — não imagens genéricas:

1. **Filme que está no imaginário.** Sucesso de público, cult ou com fandom forte; de preferência
   **atual** (lançamentos e séries recentes que estão em alta), sem descartar clássicos que todo mundo
   conhece.
2. **Personagem que vive o drama do painel.** A cena precisa comunicar a ideia daquele slide: o
   personagem compartilha o conflito (Truman preso num palco = "a vida adulta é um teatro"; o duplo
   de A Substância = narcisismo e vaidade). Um filme só para o carrossel inteiro dá unidade e puxa o
   fandom; misturar filmes quando cada painel pede um drama diferente.
3. **Capital erótico como alavanca, quando serve ao tema.** Diego prefere, quando cabe, personagens
   e atores com forte apelo (ex.: Margaret Qualley e Demi Moore em A Substância): o público responde a
   isso. Sempre adultos, sem nudez explícita, e só quando a cena também comunica o conteúdo — apelo
   sem relação com o texto é descartado.
4. **Hierarquia de escolha:** filme muito famoso **e** personagem sexy que comunica o drama >
   filme muito famoso que comunica o drama > personagem sexy de filme famoso que comunica o drama.

### Fluxo

- Na Fase 8, escrever em `image.concept` de cada slot a sugestão no formato
  `FILME: <título (ano)> — cena: <momento/personagem> — por quê: <o drama que ela carrega>`, com
  1–3 opções, e `image.strategy: manual`.
- Entregar a Diego um **roteiro de cenas** (o `editorial-report.md` ganha a seção `## Cenas`).
  Diego tira os frames e manda; registrar cada um com
  `asset add <projeto> <arquivo> --rights "still de <filme>, fornecido por Diego" --slide <id>`.
- O sistema **não baixa** frames de filme por conta própria (§56): material protegido só entra quando
  Diego fornece. Buscar/sugerir a cena, sim; coletar o arquivo, não.
- **Geração por IA (Higgsfield) é o plano B**: quando não há cena que sirva, ou para objetos e
  ambientes (armadura, poço, cadeira de juiz). A geração evoca o clima de cinema e nunca imita
  atores ou pessoas reais.

## Prioridade (spec §56, ajustada ao processo de Diego)

1. stills de filme/série escolhidos pelo roteiro de cenas e fornecidos por Diego → 2. fotos e
assets de Diego → 3. biblioteca própria (`library/images/`) → 4. frames do próprio vídeo →
5. geradas por IA → 6. licenciadas/busca externa permitida.

Registrar origem e direitos reais em `rights`, sem presumir licença.

## Regras de toda imagem gerada

- **Sem texto**, letras, números, logos ou legendas — o texto é sempre HTML.
- **Sem semelhança com pessoas reais** ou famosas.
- Evocar o clima de uma cena de cinema, nunca copiar o frame.
- Conferir visualmente **cada** imagem antes de registrar; descartar as que trazem texto.
- Respeitar o teto `assets.max_generations_per_carousel` (`config.json`); subir o teto só com aval
  de Diego.

## Fluxo (ticket)

```sh
npm run carousel -- asset request <projeto> <slide-id> --concept "<cena concreta em inglês>" [--variants n]
```

A cena vai em inglês: estilo e enquadramento do prompt são em inglês e o gerador entende melhor
assim (`image.concept`/`visual_intent` podem ficar em português para leitura de Diego; o pedido avisa
quando a cena, o mood ou o sujeito estão em português). Sem cena, o pedido é recusado.

Gera `assets/requests/<pedido>.json` com o **prompt canônico** (conceito + mood + estilo da família +
enquadramento da composição + espaço negativo + "no text"), o **negativo** padrão, a proporção e o
tamanho do slot (capa 4:5 1088×1360; `cinematic_fade` 16:10 1088×672; `image_card` 2:1 1088×544)
e o número de variantes (capa: `assets.cover_variants`, 3; miolo: `assets.body_variants`, 1).
Recusa se estourar o teto.

Depois gerar com o provider (ficha em `visual/providers/`) usando exatamente o prompt e o negativo
do pedido e registrar cada resultado **na hora** (URLs de geração expiram):

```sh
npm run carousel -- asset add <projeto> --request <pedido> --url <url> [--seed s] [--model m] [--score 0-10 --rationale "…"]
```

O engine baixa (só https, até 20 MB, só PNG/JPEG/WebP), grava sha256, o pedido completo, prompt,
negativo, seed, parâmetros e URL de origem no manifesto. A primeira imagem vira a do slide; as
demais ficam como alternativas.

## Escolher entre variantes

```sh
npm run carousel -- asset candidates <projeto> <slide-id>   # qa/candidates/<slide>.png
npm run carousel -- asset choose <projeto> <slide-id> <asset-id> --score 8 --rationale "…"
```

A folha renderiza o slide com cada imagem e o título real. Pontuar composição, leitura, espaço para
texto, coerência com o tema, novidade e identidade; registrar nota e justificativa no `choose`.
No estúdio, o seletor de imagem lista a atual, as alternativas do slide e o resto da biblioteca.

## Foco e recorte

`image.focal_point` (0–1) posiciona a imagem no slot; em `cinematic_fade` o padrão é y 0.4, para o
assunto ficar acima do fade. Zoom e deslocamento finos são tweaks (`image_scale`, `image_y`).
