# Sistema de Carrosséis Diego Moreira

MVP local de copy pronta do [plano V1](docs/plano-v1.md).
Importa copy pronta, preserva seu conteúdo e renderiza slides de 1080×1350
com duas famílias visuais. A V1 completa continua em desenvolvimento.
Veja o [estado das fases e limitações](docs/STATUS.md).

## Preparação

Node 24 LTS. A instalação deste projeto inclui um Node 24 local, usado nos
scripts npm; `.nvmrc` fixa 24.21.0 para quem usa nvm. Nenhuma configuração
global do computador é alterada.

```sh
npm ci
npx playwright install chromium
npm run fonts
npm run schemas
npm run carousel -- doctor
npm run check
```

Fontes Anton SC, Montserrat e Inter são locais, com licenças OFL e hashes.
O avatar foi extraído do template Figma fornecido; origem em
`design/brand/provenance.json`. Confirmar enquadramento na revisão visual.

## Pela interface

```sh
npm run preview -- projects/2026-09-27-demonstracao
```

Abre http://127.0.0.1:4321. Clica em **Novo**, cola a copy e escolhe a família.
Seleciona um slide para ajustar o visual ou adicionar uma imagem. Usa **Salvar
e atualizar slide** para conferir o resultado. **Criar versão** preserva o
principal. **Exportar PNGs** registra tua revisão e baixa um ZIP numerado.
Os projetos ficam disponíveis no seletor do topo.

Para criar a partir de um arquivo em um só comando:

```sh
npm run carousel -- from-copy meu-carrossel copy.md --family editorial_clean
```

## Copy pronta → PNG pelo CLI

```sh
npm run carousel -- new meu-carrossel --source copy
npm run carousel -- import-copy projects/AAAA-MM-DD-meu-carrossel copy.md
npm run carousel -- spine projects/AAAA-MM-DD-meu-carrossel
npm run carousel -- lint projects/AAAA-MM-DD-meu-carrossel
npm run carousel -- render projects/AAAA-MM-DD-meu-carrossel
npm run carousel -- preview projects/AAAA-MM-DD-meu-carrossel
```

Aceita marcadores `P1` / `Slide 1` ou painéis separados por linha em branco,
com a primeira linha como headline. No formato numerado, o body pode conter
parágrafos. O arquivo bruto fica em `source/copy-input.md`; a comparação de
conteúdo normaliza NFC e quebras de linha. A importação só funciona em um
projeto vazio para não substituir copy aprovada.

Edite `art-direction.json` para escolher família e composição por ID.
`carousel.json` guarda o conteúdo. `tweaks.json` guarda ajustes limitados:

```json
{"schema_version":1,"slides":{"k123":{"params":{"headline_size_delta":6}}}}
```

Substitua `k123` pelo ID real. Para uma imagem local:

```sh
npm run carousel -- asset add <projeto> foto.png --rights "Origem e direitos de uso" --slide <id>
```

O render salva candidatos em `qa/render/`, linhas congeladas em `fit/`,
HTML em `html/` e uma grade em `qa/contact-sheet.png`. O preview permite ajustar layout, imagens e versões; serve os
arquivos apenas em `127.0.0.1:4321`. O HTML também usa as quebras congeladas.

Após **abrir e conferir todas as imagens**, registre a revisão:

```sh
npm run carousel -- validate <projeto>
npm run carousel -- review <projeto> --reviewer Diego --note "Resultado da inspeção" --approved
npm run carousel -- export <projeto>
```

`export/` recebe somente `01.png`…`NN.png`; `qa/carrossel.zip` reúne os mesmos PNGs. Exportação recusa copy alterada,
render antigo, erro técnico, imagem necessária ausente e revisão visual
pendente. A revisão é uma declaração explícita de quem inspecionou; o engine
não faz julgamento visual sozinho.

## Desenvolvimento

```sh
npm run check       # TypeScript + testes unitários
npm run test:e2e    # Chromium: duas famílias, oito composições e gates
npm run test:studio # Interface: projetos, versões, upload e ZIP
npm run schemas    # regenerar JSON Schema após mudar contratos
```

`test:e2e` trabalha em diretório temporário e limpa apenas seus próprios
artefatos. Verifica overflow sem reescrita, detecção de arquivos alterados,
revisão obrigatória e preservação dos PNGs não ajustados.

A Skill do Claude Code está em `.claude/skills/diego-carousel/SKILL.md`.
O conteúdo editorial fica em `editorial/` e as regras visuais em `visual/`.
O MCP Higgsfield está declarado em `.mcp.json`; OAuth e geração de imagens
não foram ativados. O fluxo local dispensa credenciais.

Projetos gerados e referências privadas estão fora do Git. Não copiar `.env`
ou segredos de outros projetos. A fixture `fixtures/copy-pronta.md` é sintética
e serve para desenvolvimento; não é transcrição nem conteúdo aprovado de Diego.
