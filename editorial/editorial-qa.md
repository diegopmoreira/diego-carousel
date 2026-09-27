# QA editorial

Rodar antes da direção de arte. `carousel lint` cobre a parte determinística; o resto é leitura.
Passar no lint não prova qualidade editorial.

## Por painel

**P1** — compreensível em 1–2 s? tem conflito? tem promessa? sem explicação excessiva? sem body?

**P2** — entra direto? não repete P1? cria tensão? resiste a ser o primeiro painel visto?

**P3–P7** — cada painel acrescenta algo (`adds`)? há mecanismos, não só afirmações? há concretude
(exemplo, imagem, cena)? as headlines funcionam isoladas?

**P8** — existe segunda virada quando apropriado?

**P9** — reorganiza, em vez de só criticar?

**P10** — conclui de verdade? soa inevitável? funciona isolado?

## Geral

- [ ] Uma única tese central, em uma frase.
- [ ] As headlines contam a história sozinhas (spine + teste cego registrado).
- [ ] Existe metáfora ou imagem memorável.
- [ ] Existe pelo menos uma frase citável.
- [ ] Sem repetição entre painéis.
- [ ] Sem jargão onde uma imagem resolveria.
- [ ] A promessa da capa foi paga.
- [ ] O leitor termina enxergando algo diferente.
- [ ] Voz "tu" em tudo, inclusive legenda e CTA.
- [ ] Toda afirmação atribuída a Diego tem citação no mapa.

## Anti-padrões (reprovar)

- "5 dicas para…" e listas genéricas;
- introdução do tipo "antes de começar" ou "neste carrossel";
- P2 repetindo a capa;
- dez frases motivacionais em sequência;
- filler para chegar a dez painéis;
- jargão quando uma imagem resolve;
- headlines-rótulo ("Medo", "Solução");
- clickbait sem pagamento;
- CTA colado artificialmente;
- resumo literal da transcrição, na ordem da transcrição.

## `editorial-report.md` (modo `full`)

O lint exige estas seções:

```
## Mapa da fonte     (source-compression.md)
## Diagnóstico       (source-compression.md)
## Teses             (thesis-selection.md)
## Hooks             (hook-matrix.md, viral-score.md)
## Spine             (internal-headlines.md) — headlines + next_question
## Teste cego        (internal-headlines.md) — tese reconstruída, comparação, veredito
```

## Copy pronta (design-only)

O CLI compara headline/body com a fonte original (NFC) e confere o hash do arquivo bruto. A única
mudança aceita sobre a fonte é a aprovada por Diego em `approvals.json` (hoje: conversão de voz).
Nunca destravar a copy editando JSON; nunca mexer em `copy_locked` ou em `source/`.
