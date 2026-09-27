# QA editorial

Conferir fonte, falante, tese única, progressão, mecanismo, objeção justa, aplicação concreta e voz. Rodar lint e ler seus avisos; passar no lint não comprova qualidade editorial.

No full, `editorial-report.md` contém `## Mapa da fonte`, `## Diagnóstico`, `## Teses`, `## Hooks` e `## Spine`. Citações devem ser literais, sem preencher lacunas.

No design-only, o CLI compara headline/body com a fonte original em NFC e também verifica o hash do arquivo bruto. Este MVP não oferece autorização de compressão: não destravar a copy editando JSON. O fluxo de revisão autorizada será implementado com histórico próprio.
