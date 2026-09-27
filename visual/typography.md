# Tipografia

Família A: Anton SC 400 (títulos, caixa alta aplicada na renderização) + Montserrat 500 (body).
Família B: Inter variável — 800 nos títulos internos, 700 na capa, 400 no body. Latin + latin-ext,
licenças OFL e hashes em `design/fonts`. `font-synthesis: none` (Anton só tem 400).

**Pisos:** capa 58 px, título interno 52 px, body 36 px. Abaixo disso é falha: reescrever, não
encolher.

**Medidas** vivem em `design/tokens.json` (por família: tamanhos, pesos, entrelinhas, margens, tetos
de `fill`, capa, ênfase, imagem). Mudar um token muda todos os renders futuros e invalida os atuais.

## Quebra de linha

`design/runtime/linebreak.js`: menor número de linhas; depois, sem viúva, sem linha terminando em
palavra curta de ligação, títulos equilibrados, sem palavra solta depois de ponto final na mesma
linha e sem primeira palavra isolada. `**ênfase**` é medida com o peso da ênfase.

## Escada de ajuste (fit)

1. melhor quebra → 2. respiro vertical moderado → 3. composição alternativa (Claude) →
4. compressão editorial (Claude; em copy pronta só com autorização) → 5. fonte até o piso (body
primeiro, título por último). `fit/<id>.json` registra só as etapas executadas, `needs` e
`chars_that_fit`.

## Mapa de tinta

Depois do fit, o render redesenha o slide só com texto (cada linha do título numa cor, body verde) e
lê os pixels coluna a coluna. Se o acento ou a cedilha de uma linha encosta na vizinha, abre espaço
só acima daquela linha e refaz o fit (até 0.6em; acima de 0.4em vira aviso de revisão). Também
acusa título colado no body, tinta sobreposta e tinta fora da margem. Por isso a Família A pode usar
entrelinha 0.92. O mapa de cada slide fica em `qa/ink/NN.png`.
