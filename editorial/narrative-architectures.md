# Arquiteturas narrativas e papéis dos painéis

Padrão: **10 painéis**. Faixa: 8–12 (`config.json`). Não adicionar filler para chegar a dez; não
cortar um mecanismo necessário para ficar em dez.

## Arquitetura base

```
P1  INTERRUPÇÃO          outdoor, só título
P2  CONFLITO             "tu acha que é isso, mas…"
P3  PRIMEIRA REVELAÇÃO   primeira frase realmente memorável
P4  MECANISMO
P5  MECANISMO
P6  MECANISMO / CONTRASTE / EXEMPLO
P7  ESCALADA
P8  SEGUNDA VIRADA
P9  REORGANIZAÇÃO
P10 MARTELO
```

Valores de `narrative_role` (usar estes nomes; o engine escolhe a composição inicial por eles):
`interruption`, `conflict`, `revelation`, `mechanism`, `contrast`, `example`, `escalation`,
`second_turn`, `reorganization`, `hammer`. Os papéis das outras arquiteturas se mapeiam nestes
(ex.: "sintoma" → `interruption`, "culpado habitual" → `conflict`, "gargalo" e "categoria" →
`mechanism`, "princípio correto" → `reorganization`, "síntese" → `hammer`).

## Desconstrução — mitos, crenças sociais, relacionamentos, masculinidade, psicologia popular

```
P1 crença provocadora · P2 explicação popular · P3 por que ela é insuficiente
P4 mecanismo real 1 · P5 mecanismo real 2 · P6 mecanismo real 3 · P7 consequência
P8 segunda virada · P9 princípio correto · P10 formulação definitiva
```

## Diagnóstico — "por que isso continua acontecendo comigo"

```
P1 sintoma · P2 culpado habitual · P3 denominador comum
P4–P7 gargalos 1 a 4 · P8 desculpa que mantém tudo · P9 responsabilidade
P10 princípio de mudança
```

## Mapa — conteúdo conceitual ou filosófico

```
P1 conceito · P2 por que existe confusão · P3 princípio organizador
P4–P8 categorias · P9 como usar o mapa · P10 síntese
```

## Paradoxo

```
P1 contradição · P2 por que parece absurda · P3 distinção fundamental
P4–P7 demonstração · P8 consequência · P9 nova interpretação · P10 formulação definitiva
```

## Transformação

```
P1 estado atual / problema · P2 explicação habitual · P3 mecanismo que mantém o padrão
P4–P7 substituições ou desenvolvimentos · P8 novo princípio · P9 aplicação
P10 identidade futura / martelo
```

## Hibridização

Pode combinar duas (desconstrução + transformação, mapa + transformação, diagnóstico + paradoxo)
**só quando a tese precisa** das duas. Nunca para parecer sofisticado. Registrar em
`editorial.architecture` e `editorial.hybrid`, com a razão no relatório.

## Papéis, um a um

- **P1 — interrupção.** Outdoor. Ver `hook-matrix.md`.
- **P2 — conflito.** Não repete a capa. Introduz a explicação confortável/popular e começa a
  desmontá-la. Padrão frequente: "Tu acha que é isso, mas…".
- **P3 — primeira revelação.** Muitas vezes a primeira frase memorável ("Quem não entende a
  própria falta aceita qualquer coisa"; "O que teus fracassos amorosos têm em comum? Tu."). P3 não
  resolve: aprofunda.
- **P4–P6 — motor intelectual.** Mecanismos. Cada headline é uma ideia completa
  (`internal-headlines.md`).
- **P7 — escalada.** Consequência que sobe a aposta: o custo de continuar assim.
- **P8 — segunda virada.** Impede que o carrossel fique linear: o tema sobe de comportamento para
  princípio. Ex.: primeira metade "agradabilidade pode ser medo" → virada "sem tensão não existe
  música".
- **P9 — reorganização.** O leitor não termina só criticado. Começa a reorganizar o problema:
  "A solução não é virar mau; é recuperar a força que tu reprimiu."
- **P10 — martelo.** Não é "conclusão" nem "siga meu perfil". É a consequência inevitável dos nove
  painéis anteriores; a headline funcionaria como post isolado. CTA opcional
  (`language-style.md`).

## Resiliência de entrada

O Instagram pode mostrar o carrossel a partir de P2 ou P3. Por isso P2 e P3:
- fazem sentido razoavelmente isolados;
- têm headline forte, com tensão ou curiosidade própria;
- não dependem de uma frase do painel anterior para serem entendidos.

Não precisam ser três capas artificiais.

## Checklist

- [ ] Arquitetura escolhida (ou híbrida) com razão registrada.
- [ ] Cada painel tem um `narrative_role`.
- [ ] Existe segunda virada quando a tese permite.
- [ ] P9 reorganiza; P10 conclui e se sustenta sozinho.
- [ ] P2 e P3 resistem a ser o primeiro painel visto.
