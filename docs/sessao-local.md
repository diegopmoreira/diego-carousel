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
