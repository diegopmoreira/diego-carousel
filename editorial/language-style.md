# Linguagem

## Voz: sempre "tu"

Decisão de Diego, inclusive na capa e nas headlines. Conjugação coloquial, como no briefing:

- "tu faz", "tu é", "tu sabe", "tu tá";
- imperativo coloquial: "para de…", "aprende", "segue", "escolhe";
- "teu/tua", "pra ti", "contigo", "de ti".

| Não | Sim |
|---|---|
| "Você merece ser amado." | "Tu não precisa merecer atenção. Precisa escolher onde bebe." |
| "Pare de se sabotar." | "Para de chamar medo de gentileza." |
| "Seu problema é…" (ambíguo) | "Teu problema é…" |

O lint trata "você" como **erro** no modo `full` e como **aviso** em copy pronta; "seu/sua" é
sempre aviso (pode ser terceira pessoa).

## Regra de ouro do briefing

Motivacional, terapêutico-fofo ou gringo demais → **fora**.
Clínico, direto, intelectualmente honesto → **dentro**.

Proibido (o lint bloqueia): "você merece", "transforme sua vida", "descubra o segredo", "junto com
você nessa jornada", "vamos juntos", "acredite em si mesmo", "antes de começar", "neste carrossel",
"siga meu perfil", "compartilhe com seus amigos", "5 dicas".

## Tom

```
conceito sério + imagem concreta + ocasional ironia leve
```

Nem academicismo morto nem coach vazio. Jargão só quando nenhuma imagem resolve; quando resolve,
usar a imagem.

| Academicismo | Coach | Diego |
|---|---|---|
| "A dependência afetiva configura-se como padrão desadaptativo." | "Tu merece um amor que te valorize!" | "Tu tá bebendo água salgada e chamando de sede." |

## Contraste como descoberta

Muitas revelações são distinções entre coisas que o leitor confunde:

```
olhar ≠ escolher · atenção ≠ amor · bondade ≠ submissão · força ≠ crueldade
intensidade ≠ profundidade · sentir ≠ governar
```

## Metáforas

Modelos mentais, não enfeites. Uma metáfora boa explica o mecanismo e pode organizar vários
painéis (`continuity.md`). Não empilhar metáforas diferentes num mesmo painel.

## Provocação

Gancho agressivo, desenvolvimento justo. A provocação pode atacar uma crença, um comportamento, uma
desculpa, uma estratégia ou uma interpretação — nunca a dignidade do leitor.

## CTA (opcional)

O CTA nasce da tese.

| Ruim | Bom |
|---|---|
| "Compartilhe com seus amigos." | "Manda pra alguém que ainda confunde atenção com amor." |
| "Siga para mais." | "Comenta FORÇA." (`cta.type: comment_keyword`, `keyword: FORÇA`) |

Um carrossel forte não precisa terminar com pedido explícito (`cta.type: none`). O rodapé "Segue o
perfil…" do penúltimo painel é do layout, não do texto.

## Legenda (`editorial.caption`)

Duas a quatro frases que retomam a tese sem repetir a capa, na mesma voz, com o CTA quando houver.

## Markup

- `**ênfase**` marca palavras de destaque; em copy pronta, palavras em CAIXA ALTA dentro de texto
  misto viram ênfase automaticamente. O estilo visual é definido por família.
- `\n` dentro do body separa parágrafos.
- A caixa alta da Família A é aplicada na renderização: escrever em caixa natural.

## Copy pronta (design-only)

Não corrigir voz, expressões nem tamanho silenciosamente. Apontar o problema, preservar a fonte e,
para voz, gerar a proposta com `carousel voice <projeto>`; ela só entra com o aval de Diego
(`carousel approve <projeto> voice --by <nome>`, registrado em `approvals.json`). Nunca rodar
`approve` sem Diego ter aprovado explicitamente na conversa.
