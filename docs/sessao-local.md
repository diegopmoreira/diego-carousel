# Sessão local — o que só roda no Mac do Diego

Tudo que depende do Corpus (MCP `corpus-diego` e disco), das referências privadas
(`references/diego/`, fora do Git), do `~/Downloads` e do login OAuth do Higgsfield. O resto já foi
feito e testado na nuvem. Cada bloco tem um prompt para colar no Claude Code local, aberto na raiz
do projeto.

## 0. Preparar (uma vez)

```sh
cd ~/diego-carousel
git fetch origin && git checkout claude/nifty-keller-j55hab && git pull
npm ci
npx playwright install chromium
npm run carousel -- doctor
npm run check && npm run test:e2e && npm run test:studio
```

Tudo verde antes de seguir. Se `doctor` reclamar do Chromium, rode de novo o `playwright install`.

## 1. Conferir o formato real do Corpus (Rodada 1)

O leitor `corpus:<id>` foi escrito a partir da descrição do plano (`texto`, `segmentos`,
`palavras`) e testado só com fixtures sintéticas (`fixtures/corpus/`).

> Prompt: "Abre `~/Library/Application Support/CorpusDiego/data/transcricoes/lE--NmXpw5o/v1.json`
> e compara as chaves com o que `engine/source/corpus.ts` espera (texto, segmentos com
> inicio/fim/texto/falante, metadados de tipo/título). Se o formato for diferente, ajusta o leitor
> e as fixtures sintéticas para o formato real, sem copiar texto do Diego para as fixtures. Depois:
> usa o MCP corpus-diego para achar um vídeo que seja supervisão e outro que seja conversa, e
> confirma que `npm run carousel -- new teste --source corpus:<id>` recusa os dois e aceita
> lE--NmXpw5o. Apaga os projetos de teste. Roda `npm run check` e faz commit."

Se o Corpus não estiver no caminho padrão: `export CAROUSEL_CORPUS_DIR=<pasta que contém transcricoes/>`.

## 2. Semear a biblioteca genética (Rodada 1)

> Prompt: "Lê `genetic-library/README.md`. Para cada carrossel em `references/diego/carousels`
> (post31:07, post7:7, post03:06, post18:05, post22:07), abre os 10 PNGs e transcreve para
> `genetic-library/editorial/<slug>.yaml` o texto EXATO de cada painel (sem corrigir nada), a tese
> reconstruída, a arquitetura e os papéis. Faz também o `genetic-library/visual/<slug>.yaml`.
> Roda `npm run carousel -- library validate` e `library stats`. Com o resultado, ajusta
> `editorial.body_range` em `config.json` (p10–p90 dos bodies) e me mostra os números antes de
> gravar."

Diego: dizer quais desses (ou outros) foram os que mais performaram — eles viram os exemplos
preferidos na Fase 4 da Skill.

## 3. Três carrosséis `full` de verdade (critério da Rodada 1)

Rodar um de cada vez, com o checkpoint após a tese ligado (`config.json`).

> Prompt 1: "/diego-carousel com `~/Downloads/Texto colado.txt` (O tipo de homem que sempre se
> arrebenta). Modo full, checkpoint depois da tese."

> Prompt 2: "/diego-carousel com `corpus:lE--NmXpw5o` (Todo sarcástico é um invejoso assustado)."

> Prompt 3: "Usa o MCP corpus-diego para achar o vídeo público sobre carência afetiva com a
> metáfora sede → água salgada → poça → poço (falante Diego, nunca supervisão) e roda
> /diego-carousel com ele."

Pronto quando, para os três: `lint` limpo, `## Teste cego` registrado com veredito aprovado, render
e `validate` verdes (exceto imagens pendentes) e Diego reconhece o DNA lendo `spine`.

## 4. Fixture 4 — carrossel publicado em formato Figma

> Prompt: "Transcreve um carrossel publicado (sugestão: post7:7) no formato do plugin Figma
> (painéis separados por linha em branco, primeira linha = título) em
> `references/diego/fixture-4.md` e roda `from-copy fixture-4 references/diego/fixture-4.md`.
> O lint precisa confirmar texto idêntico."

A copy publicada é pública, mas fica em `references/` (fora do Git) até Diego dizer que pode versionar.

## 5. Calibrar a fidelidade visual (Rodada 2)

Recriar 3 slides publicados com a mesma copy e imagem e comparar:

> Prompt: "Calibra a Família A e a B contra os publicados. Para `post31:07` (capa e um interno com
> foto) e `post7:7` (um interno com card): cria projetos com a mesma copy (from-copy) e as mesmas
> imagens (asset add com --rights 'recorte do post publicado, só para calibração'), escolhe as
> composições equivalentes, renderiza e roda `npm run carousel -- calibrate <projeto> --slide n --ref
> references/diego/carousels/<post>/Slide n.png`. Abre as folhas em `qa/calibrate/` e ajusta SÓ
> `design/tokens.json` (tamanhos, entrelinhas, margens, posições) até a diferença ficar pequena nas
> faixas de título e body. Me mostra antes/depois e os números. Não mexe na copy."

Pronto quando: diferença pequena nos 3 slides e um carrossel real de Diego (copy + fotos dele)
exportado sem ajuste fora do estúdio.

Conferir também: `npm run carousel -- gallery --image <uma foto real>` e olhar `gallery/gallery.png`.

## 6. Imagens pelo Higgsfield (Rodada 3)

1. No Claude Code local: `/mcp` → higgsfield → autenticar (OAuth). Ler `visual/providers/higgsfield.md`.
2. > Prompt: "No projeto <x>, gera a capa: `asset request` para a capa, gera as 3 variantes pelo
   > MCP Higgsfield com o prompt e o negativo do pedido, confere cada uma (sem texto, sem pessoa
   > real), registra com `asset add --request … --url …`, roda `asset candidates` e escolhe com nota
   > e justificativa. Depois faz o mesmo para os painéis com imagem."
3. Testar `asset frame <projeto> <video.mp4> --at mm:ss --slide <id>` com um vídeo de Diego (precisa
   de ffmpeg: `brew install ffmpeg`).

Pronto quando: um carrossel `full` sai com capa e imagens internas geradas, sem texto nas imagens,
e o manifesto tem pedido completo e sha256 de cada uma.

## 7. Avaliação final (Rodada 4)

1. Escolher os vídeos das fixtures 2 (diagnóstico denso) e 3 (metáfora da carência) no Corpus e
   trocar `ESCOLHER` em `fixtures/eval.json`.
2. `npm run eval -- --dry-run` (tudo "pronto"), depois `npm run eval` (roda cada fixture pelo
   `claude -p` com a Skill; relatório em `eval/`).
3. Opcional: `export.sync_dir` em `config.json` apontando para uma pasta do iCloud Drive, para os
   PNGs aparecerem no celular.

## Critérios de pronto da V1 (§93)

- Editorial: três transcrições inéditas viram carrosséis reconhecíveis como de Diego (item 3).
- Estrutura: as spines contam a história sozinhas (teste cego registrado).
- Visual: parentes dos publicados sem cópia mecânica (item 5).
- Técnica: 1080×1350 sem overflow (gates do render).
- Automação: transcrição → PNGs sem editar código (item 7).
- Editabilidade: mudar texto, imagem ou tamanho sem refazer tudo (estúdio).
- Qualidade: pelo menos um ciclo de inspeção visual antes do export (review).
