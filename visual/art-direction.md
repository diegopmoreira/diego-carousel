# Direção de arte

A direção de arte separa o raciocínio visual da execução. Fica em `art-direction.json`, um registro
por slide (pelo ID opaco): `visual_role`, `composition`, `density`, `layout`, `image` (need,
concept, mood, subject_priority, crop, negative_space, strategy, focal_point, alternatives) e `fit`.
O `draft`/`import-copy` cria uma primeira versão por função narrativa
(`engine/project/direction.ts`); revisar sempre. Para trocar a composição de um slide:
`composition <projeto> <slide-id> <composição>` (leva junto posição do texto, ajuste do título,
densidade e a decisão de imagem).

## Família (heurística, não regra)

| Preferir `cinematic_condensed` quando | Preferir `editorial_clean` quando |
|---|---|
| assunto emocional, identidade, conflito | diagnóstico, argumentação racional |
| frase de grande impacto, metáfora humana | vários mecanismos, mapa, estrutura didática |
| atmosfera, narrativa dramática | necessidade maior de body, informação densa |
| há imagens boas para a maioria dos painéis | poucas imagens |

Contrariar a heurística só com justificativa visual clara, registrada em `rationale`.

## Função → composição (preferências)

```
interrupção (P1)     → full_bleed (capa); cinematic_fade; giant_statement
conflito             → text_only
revelação            → giant_statement (frase curta) ou cinematic_fade
mecanismo            → cinematic_fade (A) · text_only / image_card (B)
contraste            → contrast
exemplo              → image_card · cinematic_fade
escalada             → text_only
segunda virada       → reset visual: giant_statement ou imagem dramática
reorganização        → text_only
martelo (P10)        → giant_statement · full_bleed · minimal_pause
```

## Densidade e ritmo

- LOW = só título; MEDIUM = título + body; HIGH = título + body + imagem. Nunca todos HIGH: o
  carrossel precisa respirar.
- A forma acompanha a curva do argumento, por exemplo: P1 forte · P2 médio · P3 forte · P4–P5
  informativos · P6 visual · P7 denso · P8 ruptura · P9 organizado · P10 forte.
- Nunca três composições iguais seguidas (o lint barra); o render avisa quando uma composição domina
  mais da metade do carrossel ou quando há menos de três composições.

## Imagem por slide

- `concept`: a cena, concreta ("um copo de água do mar sobre uma mesa escura"), não o tema
  ("carência").
- `mood`, `subject_priority` (rosto, mãos, objeto), `negative_space` (onde o texto vai ficar).
- A imagem representa a emoção, cria associação cultural, oferece metáfora ou clima; se for só
  decoração, trocar por composição de texto.
- A capa recebe o maior orçamento: 3 variantes e folha de candidatas (`visual/image-policy.md`).

## Teste anti-"deck de IA"

"Este slide parece uma apresentação SaaS feita por IA?" Sinais: muitos cards, glassmorphism,
gradiente azul/roxo sem função, ícones genéricos, pills demais, dashboards inventados, sombras
excessivas, simetria corporativa. Se sim, refazer a direção.

A aprovação técnica (render e gates) não aprova o conceito visual.
