# Descoberta e escolha da tese

## Mecanismo preferencial

Procurar ao mesmo tempo:

```
CRENÇA POPULAR + CONTRADIÇÃO + EXPLICAÇÃO MELHOR
```

```
As pessoas pensam X.
Existe um problema com X.
Um mecanismo mais preciso é Y.
→ comprimir Y numa frase memorável.
```

Exemplo (da especificação):

```
Crença:     Mulheres gostam de homens maus.
Problema:   Isso confunde crueldade com atratividade.
Mecanismo:  Autonomia, força, coragem e assertividade podem aparecer misturadas à crueldade.
Tese:       Não é a maldade que atrai; é a força que o bonzinho teve medo de desenvolver.
```

Gravar em `editorial.belief`, `contradiction`, `mechanism`, `central_thesis`.

## Uma boa tese

- cabe numa frase;
- explica algo (tem mecanismo, não só opinião);
- tem tensão: mexe numa crença, numa desculpa ou numa identidade;
- reorganiza a percepção do leitor;
- permite desenvolvimento: **gera pelo menos seis implicações diferentes** (se não gera, vira
  carrossel com filler);
- não depende só de choque;
- é defensável com a fonte;
- aponta para uma conclusão mais madura que a crença inicial.

**Se é apenas polêmica, não é tese.**

| Ruim | Por quê | Melhor |
|---|---|---|
| "Homem bonzinho se dá mal." | constatação, sem mecanismo | "Não é a maldade que atrai; é a força que o bonzinho teve medo de desenvolver." |
| "Carência é o problema de todo mundo." | vaga, sem contradição | "A sede é legítima; o problema é beber água salgada." |
| "Terapia não funciona." | só choque, indefensável | — descartar |

## `## Teses` (no relatório)

Levantar 3–6 candidatas. Para cada uma: formulação, crença atacada, mecanismo, citações de apoio
(números do mapa), seis implicações em uma linha cada, vulnerabilidade principal. Depois:
**escolher UMA** e dizer por quê (tensão, defensabilidade, espaço para progressão).

Com o Corpus: rodar `consultar_corpus` (falante = Diego, excluindo supervisões) para checar se a
tese é coerente com o que Diego diz em outros vídeos e encontrar formulações próprias dele.

## Backlog

Toda tese boa que não foi escolhida vai para `ideas/backlog.jsonl`, uma linha por tese:

```sh
npm run carousel -- idea add --thesis "…" --source corpus:<id> --why "…" [--project <slug>]
```

## Checkpoint

Se `config.json` tiver `editorial.checkpoint_after_thesis: true` (padrão nas primeiras semanas) ou o
pedido disser "com aprovação": apresentar tese escolhida, duas alternativas e 3 hooks a Diego e
esperar a escolha antes da spine.

## Checklist

- [ ] Crença, contradição e mecanismo explícitos.
- [ ] Tese em uma frase, com apoio literal.
- [ ] Seis implicações listadas.
- [ ] Alternativas registradas no relatório e no backlog.
