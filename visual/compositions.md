# Composições

Vocabulário, não templates. A direção inicial vem de `engine/project/direction.ts` pela função
narrativa do painel; Claude revisa, Diego ajusta no estúdio. Nunca três composições iguais seguidas;
nunca todos os painéis HIGH.

| Composição | Uso | Imagem | Texto |
|---|---|---|---|
| `full_bleed` | capa; martelo com imagem | tela inteira + gradiente embaixo | embaixo; capa A à esquerda sem rodapé, capa B centralizada com o cue |
| `cinematic_fade` | revelação, mecanismo, exemplo (Família A) | topo, ~50% (A 660 px, B 600 px), fade para o fundo | logo abaixo da imagem |
| `image_card` | exemplo, mecanismo (Família B) | card 960×485, raio 32, em y 645 | centralizado acima do card |
| `text_only` | conflito, escalada, reorganização | — | bloco centralizado na área livre |
| `giant_statement` | revelação curta, segunda virada, martelo | — | título preenche (fill) até o teto da família |
| `minimal_pause` | pausa, frase curta | — | centralizado, menor, body apagado |
| `quote` | frase citável | — | aspas grandes discretas acima do título, sem filete |
| `contrast` | distinção X ≠ Y | — | divisor curto entre título e body |

`layout.headline_position`: `top` encosta no início da região; `center` equilibra (padrão das
composições de texto); `bottom` apoia embaixo (padrão da capa). `align`: `left` ou `center`.

Só `full_bleed`, `cinematic_fade` e `image_card` têm slot de imagem. Imagem marcada como necessária
(`image.need`) bloqueia o export enquanto for placeholder; o placeholder mostra o conceito pedido.

Para revisar o vocabulário inteiro: `npm run carousel -- gallery [--image foto.jpg]` gera
`gallery/gallery.png` com as oito composições nas duas famílias.
