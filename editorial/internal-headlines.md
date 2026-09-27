# Headlines internas e Title Spine

## Cada headline é uma pequena tese

Nos painéis internos, a headline contém **uma ideia completa**, uma proposição. Nunca um rótulo.

| Ruim (rótulo) | Bom (proposição) |
|---|---|
| "Medo" | "Todo 'sim' dado por medo cobra juros depois." |
| "Maturidade" | "Atenção barata não é amor." |
| "Solução" | "Bondade usada como moeda deixa de ser bondade." |
| "Ponto 1" | "Quem não entende a própria falta aceita qualquer coisa." |

O lint avisa headlines com menos de 3 palavras.

## Famílias de headline (`headline_type`)

| `headline_type` | Família | Exemplo |
|---|---|---|
| `cause` | Causa | "Tu tá sozinho porque se tornou invisível." |
| `consequence` | Consequência | "Todo 'sim' dado por medo cobra juros depois." |
| `contrast` | Contraste | "Beleza abre a porta, mas paz mantém a casa de pé." |
| `reframe` | Reenquadramento | "Atenção barata não é amor." |
| `metaphor` | Metáfora | "Sem tensão, não existe música." |
| `command` | Comando | "Escolhe os poços onde vale a pena beber." |
| `question` | Pergunta | "O que teus fracassos amorosos têm em comum? Tu." |
| `statement` | Afirmação (capa ou martelo) | "Não é a maldade que atrai." |

Variar as famílias ao longo da spine. Cinco reenquadramentos seguidos cansam.

## Headline + body

```
HEADLINE = pequena tese
BODY     = prova, explicação, consequência, exemplo ou concretização DA MESMA tese
```

O body nunca introduz outro assunto. Se o body precisa de outra ideia, ela é outro painel.

## Densidade

```
1 headline forte + 2–4 frases de desenvolvimento ≈ 200–350 caracteres úteis por painel
```

Faixa de referência, não limite rígido (o lint avisa fora de 120–350 até a calibração com os
carrosséis publicados). Evitar os extremos:

- **anêmico:** "Tu precisa mudar." → próximo slide: "Sabe por quê?"
- **parede de texto:** parágrafos que não cabem com conforto na tela.

## Title Spine — o teste mais forte

Antes de escrever qualquer body, escrever só as headlines P1…P10 e ler em sequência.
**As headlines sozinhas precisam contar o argumento inteiro.** Se não contam, não escrever bodies
ainda: corrigir a spine.

```sh
npm run carousel -- spine <projeto>            # headlines com IDs
npm run carousel -- spine <projeto> --blind    # só as headlines, para o teste cego
```

### Teste cego

Um subagente recebe **apenas** a saída de `spine --blind` (sem tese, sem relatório, sem bodies) e
responde: (1) qual é a tese em uma frase; (2) o argumento avança a cada painel? onde tropeça?
(3) qual painel poderia sair. Registrar em `## Teste cego` do relatório: a tese reconstruída, a
comparação com `central_thesis` e o veredito (`aprovado` / `corrigir`). Se a tese reconstruída não
bate, corrigir a spine e repetir. Nunca declarar que houve teste cego sem ter rodado.

## Exemplo de spine (arquitetura base, tese da especificação)

```
P1  Por que mulheres parecem gostar de homens maus?
P2  Tu acha que é a crueldade que atrai
P3  O bonzinho não é bom: ele tem medo
P4  Todo "sim" dado por medo cobra juros depois
P5  Bondade usada como moeda deixa de ser bondade
P6  Força e crueldade vêm no mesmo pacote só no começo
P7  Quem nunca diz não também nunca é escolhido
P8  Sem tensão, não existe música
P9  A solução não é virar mau; é recuperar a força que tu reprimiu
P10 Não é a maldade que atrai; é a força que o bonzinho teve medo de desenvolver
```

Ilustrativo: mostra a forma, não é um carrossel publicado.

## Checklist

- [ ] Nenhuma headline interna é rótulo.
- [ ] Famílias de headline variadas.
- [ ] Cada body prova a própria headline, sem assunto novo.
- [ ] Spine lida sozinha conta o argumento.
- [ ] Teste cego rodado e registrado.
