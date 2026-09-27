# Biblioteca genética

Exemplos reais de Diego, anotados, para ensinar padrões por exemplo e não só por regra.
Prioridade de decisão: **carrosséis próprios bons > DNA definido (`editorial/`) > referências externas**.

Só entram carrosséis **publicados por Diego** (ou aprovados por ele). Nunca preencher com exemplos
inventados apresentados como dele. As imagens originais ficam em `references/diego/` (fora do Git);
aqui ficam só as transcrições e anotações.

## `editorial/<slug>.yaml`

```yaml
name: inteligencia-emocional          # slug do post
published: post31:07                  # pasta em references/diego/carousels
family: cinematic_condensed           # família visual usada
thesis: "…"                           # a frase central, reconstruída da spine
architecture: map                     # base | deconstruction | diagnosis | map | paradox | transformation (+ hybrid)
hook_family: question                 # hook-matrix.md
cta: none                             # none | share_specific | comment_keyword
slides:
  - n: 1
    role: interruption
    headline: "…"                     # texto exato do PNG, em NFC, sem corrigir nada
    body: null
  - n: 2
    role: conflict
    headline: "…"
    body: "…"
notes: "o que este carrossel ensina (segunda virada, metáfora, densidade…)"
```

## `visual/<slug>.yaml`

```yaml
name: inteligencia-emocional
family: cinematic_condensed
cover: {composition: full_bleed, headline_position: bottom, align: left, footer: false}
body: {image_position: top, image_ratio: 0.48, headline: condensed, body: sans}
measures: {headline_px: 92, headline_lh: 0.92, body_px: 35, margin_x: 50}
```

A semente (5 carrosséis de `references/diego/carousels`) é transcrita na sessão local: ver
`docs/sessao-local.md`. Os limites do lint (faixa de caracteres do body, pronomes) são calibrados
nesses exemplos com `npm run carousel -- library stats`.
