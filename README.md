# Sistema de Carrosséis Diego Moreira

Agente editorial e visual para Claude Code: transforma uma transcrição pública de Diego (arquivo ou
Corpus) em carrossel de Instagram — tese, copy, direção de arte e PNGs 1080×1350 — ou diagrama uma
copy pronta. Claude decide o que exige julgamento (tese, argumento, linguagem, direção de arte,
crítica); o engine faz o determinístico (contratos, layout, fit, render, gates, export).

- Plano em vigor: [docs/plano-v2.md](docs/plano-v2.md) · estado: [docs/STATUS.md](docs/STATUS.md)
- O que roda só no Mac do Diego: [docs/sessao-local.md](docs/sessao-local.md)
- Skill: `.claude/skills/diego-carousel/SKILL.md` (`/diego-carousel`)
- Conhecimento editável: `editorial/` (DNA editorial), `visual/` (DNA visual), `genetic-library/`

## Preparação

```sh
npm ci
npx playwright install chromium     # no Mac; na nuvem o hook usa o Chromium já instalado
npm run carousel -- doctor
npm run check && npm run test:e2e && npm run test:studio
```

Node 24 vem como dependência local (nada global muda). Fontes Anton SC, Montserrat e Inter são
locais (OFL, com hashes). Avatar: `design/brand/avatar.png` (`npm run brand` o regenera a partir
de `avatar-source.png`).

Stills de filmes e séries (opcional): criar uma chave gratuita em themoviedb.org → Configurações →
API, copiar `.env.example` para `.env` e preencher `TMDB_API_KEY`. Com ela, `asset search/pick`
busca as imagens de fundo do título e registra as escolhidas com a origem. This product uses the TMDB
API but is not endorsed or certified by TMDB.

## Usar pelo Claude Code

- "Faz um carrossel do vídeo `corpus:<id>`" ou "…desta transcrição" → modo `full`.
- "Diagrama esta copy" → `design-only` (copy travada; "você" gera proposta em "tu" que só entra com
  teu aval).
- "Aumenta o título do 4" → ajuste pontual; "faz no estilo B" → variante.

## App para o Dock (Mac)

```sh
scripts/build-mac-app.sh        # cria ~/Applications/Carrosséis.app
```

Um clique abre o menu: ligar/desligar o estúdio, abrir no navegador, pasta dos carrosséis, atualizar
(git pull + npm ci), diagnóstico, copiar relatório de erro (vai para a área de transferência e para a
Mesa), log (`~/Library/Logs/DiegoCarousel/estudio.log`) e renovar o login do Claude. Os mesmos
comandos rodam no terminal: `scripts/estudio.sh start|stop|status|update|doctor|report|log`.

## Estúdio

```sh
npm run preview            # abre o projeto mais recente (ou um vazio) em http://127.0.0.1:4321
npm run preview -- projects/AAAA-MM-DD-slug
```

**Novo → Da transcrição:** cola a transcrição (a do YouTube serve) ou informa o ID do vídeo no Corpus.
O agente editorial (o teu Claude Code rodando a Skill, sem conversa) faz o mapa da fonte, o
diagnóstico, as teses e os hooks; tu escolhe a tese na tela; ele escreve a spine e a copy, faz o
teste cego, sugere as cenas e renderiza. O progresso aparece no estúdio. Precisa do Claude Code
instalado e logado neste computador (`doctor` confere). **Novo → Copy pronta** diagrama copy já
escrita.

Criar projeto colando copy, ajustar cada slide com **prévia ao vivo**, trocar imagem entre
alternativas, enviar fotos, ver como **post do Instagram** (e o recorte 3:4 da grade), ligar a
**área segura**, criar versões, aprovar propostas de voz/edição e exportar o ZIP (a exportação
registra tua revisão). Mudanças feitas pelo Claude ou pelo CLI aparecem na hora.

## CLI (principais)

```sh
npm run carousel -- help                                   # lista completa
npm run carousel -- new <slug> --source corpus:<id>|<arquivo.txt>|copy
npm run carousel -- draft <projeto> copy.md --meta editorial.json
npm run carousel -- from-copy <slug> copy.md [--family cinematic_condensed]
npm run carousel -- lint|spine [--blind]|status <projeto>        # status: próximo passo (next)
npm run carousel -- render|validate|export <projeto>
npm run carousel -- fit-probe <projeto> <slide-id> | autofit <projeto>
npm run carousel -- composition <projeto> <slide-id> <composição> | image <projeto> <slide-id> --need|--none
npm run carousel -- agent start|choose|status|stop <projeto>   # agente editorial: transcrição → copy → render
npm run carousel -- asset search <projeto> "<filme>" --slide <id> | asset pick <projeto> <busca> <n…>   # stills do TMDB
npm run carousel -- asset request|add|candidates|choose|frame ...
npm run carousel -- voice|edit ... ; approve <projeto> voice|edit --by Diego
npm run carousel -- gallery | calibrate <projeto> --slide n --ref <png> | migrate <projeto>
```

O render grava `qa/render/` (PNGs candidatos), `fit/` (linhas congeladas), `qa/ink/` (mapas de
tinta), `qa/contact-sheet.png` e `render-manifest.json` (hashes, avisos). O export exige lint,
validate e revisão visual do render atual; `export/` recebe só `01.png…NN.png` e `qa/carrossel.zip`
o ZIP (copiado para `export.sync_dir`, se configurado).

## Desenvolvimento

```sh
npm run check        # TypeScript + testes unitários
npm run test:e2e     # render: famílias, composições, gates, ink map, fluxo full, imagens, sync
npm run test:studio  # estúdio no Chromium: UI, prévia, Instagram, eventos, segurança, ZIP
npm run eval -- --dry-run | --engine-only   # fixtures de aceite (§94); completo roda via claude -p
npm run schemas      # regenerar JSON Schema após mudar contratos
```

Os testes trabalham em pastas temporárias (`CAROUSEL_PROJECTS_DIR`) e nunca escrevem em
`projects/` ou `fixtures/`. Na nuvem, o hook `.claude/hooks/cloud-setup.sh` instala dependências e
define `CAROUSEL_CHROMIUM`. Trocar de navegador ou mexer em arquivos que chegam ao pixel invalida os
renders existentes (hash de ambiente).

Projetos, `references/diego/`, `gallery/` e `eval/` ficam fora do Git. Nunca copiar `.env` ou
credenciais. O MCP Higgsfield está declarado em `.mcp.json` (OAuth local, sem segredo).
