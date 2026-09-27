# Imagens

## Prioridade (spec §56)

1. fornecidas por Diego → 2. biblioteca própria (`library/images/`) → 3. frames do próprio vídeo →
4. licenciadas/autorizadas → 5. geradas por IA → 6. busca externa permitida.

Nunca baixar material protegido só porque combina (stills de filme entram apenas se Diego fornecer,
com `rights` preenchido). Registrar origem e direitos reais, sem presumir licença.

## Regras de toda imagem gerada

- **Sem texto**, letras, números, logos ou legendas — o texto é sempre HTML.
- **Sem semelhança com pessoas reais** ou famosas.
- Evocar o clima de uma cena de cinema, nunca copiar o frame.
- Conferir visualmente **cada** imagem antes de registrar; descartar as que trazem texto.
- Respeitar o teto `assets.max_generations_per_carousel` (`config.json`); subir o teto só com aval
  de Diego.

## Fluxo (ticket)

```sh
npm run carousel -- asset request <projeto> <slide-id> [--concept "…"] [--variants n]
```

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
