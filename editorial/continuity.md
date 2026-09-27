# Continuidade e anti-filler

## A pergunta que cada painel deixa

Depois de cada painel, perguntar: **que pergunta mental este slide cria?** O painel seguinte
responde a ela (e cria outra). Gravar em `next_question` de P1…P(n-1). Não aparece no slide: é
ferramenta de construção. O último painel não deixa pergunta pendente.

```
P2 "O problema não é ser carente."              → next_question: "Então qual é?"
P3 "Quem não entende a própria falta aceita qualquer coisa." → "Como isso aparece?"
P4 "Atenção barata não é amor."                 → "Então por que continuo buscando?"
```

`next_question` ruim: "E agora?", "O que mais?" — genérica, serve para qualquer painel.

## O que cada painel acrescenta (`adds`)

Cada painel acrescenta **pelo menos uma** novidade. Vocabulário de `adds`:

`cause` · `consequence` · `mechanism` · `example` · `metaphor` · `objection` · `contrast` ·
`application` · `turn` · `principle`

Regra anti-filler: se dois painéis cumprem exatamente a mesma função, **fundir ou excluir**. O lint
avisa quando painéis vizinhos repetem o mesmo `adds`.

## Pares adjacentes

Ler cada par (Pn, Pn+1):
- o segundo responde à pergunta do primeiro?
- há repetição de argumento com outras palavras?
- uma mudança de registro (do exemplo para o princípio, do comportamento para a identidade) tem
  ponte compreensível?

Variar a função do painel, não só o comprimento. Pausa serve para fixar uma descoberta; exemplo
serve para testar uma distinção.

## Segunda virada

P7/P8 impedem o carrossel de ficar previsivelmente linear: o tema sobe de comportamento para
princípio (ou de sintoma para identidade). Sem virada, P8 costuma ser o painel que sobra.

## Metáfora como fio

Uma boa metáfora organiza vários painéis — é modelo mental, não enfeite:

```
sede → água salgada → poça → poço
```

Se houver metáfora central, gravar em `editorial.central_metaphor` e verificar que ela volta de
forma coerente (sem trocar de imagem no meio).

## Checklist

- [ ] `next_question` específica em P1…P(n-1).
- [ ] `adds` preenchido em todos os painéis; vizinhos não repetem.
- [ ] Nenhum par de painéis com a mesma função.
- [ ] Segunda virada presente (ou ausência justificada).
