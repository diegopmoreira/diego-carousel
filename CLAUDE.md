# Diego Carousel

Plano atual: `docs/plano-v2.md` (v1 em `docs/plano-v1.md`). Implementação atual e pendências: `docs/STATUS.md`.
Skill: `.claude/skills/diego-carousel/SKILL.md`.

Use Node 24. `npm ci`, `npm run check`, `npm run carousel -- doctor`.
Nunca copiar credenciais. Referências privadas e projetos gerados não entram no Git.
Não modificar copy_locked ou a fonte para contornar o lint. IDs de slide são opacos.
Não registrar QA visual sem abrir as imagens. Não afirmar que toda a V1 está concluída.
Testes nunca escrevem em `projects/` ou `fixtures/`: usar `CAROUSEL_PROJECTS_DIR` apontando para uma pasta temporária.
Na nuvem, `CAROUSEL_CHROMIUM=/opt/pw-browsers/chromium` (o hook de SessionStart define). Nunca rodar `playwright install` lá.
Revisão visual automática: `review` sem `--human`. Só usar `--human` quando uma pessoa de fato conferiu.
