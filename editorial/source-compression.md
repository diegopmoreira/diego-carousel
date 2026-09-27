# Fonte → mapa → briefing → diagnóstico

A transcrição não é prosa acabada. Tem repetição oral, autocorreção, digressão, exemplo lateral,
pensamento incompleto, a mesma frase dita três vezes com palavras diferentes, mudança de ordem e
apartes. **A função não é transcrever; é reconstruir.** A ordem da fonte não precisa ser preservada.

## 1. Normalizar (intelectualmente)

```
transcrição bruta → remover ruído → segmentar por ideias → agrupar ideias equivalentes
→ separar tese / explicação / exemplo / metáfora → mapa conceitual
```

O engine só remove timestamps e "N segundos" do copiar-colar do YouTube. Todo o resto é trabalho do
Claude. Ler a transcrição inteira **uma vez**, montar o mapa e daí em diante trabalhar sobre o mapa,
voltando à fonte só para conferir passagens pontuais (mantém o contexto enxuto).

**Preservar sempre:** formulações originais especialmente boas, exemplos concretos, metáforas,
analogias, objeções, frases que soam particularmente como Diego.

## 2. Comprimir

```
eliminar repetição oral → extrair 10–30 ideias reais → separar tese de exemplo
→ separar causa de consequência → identificar metáforas → identificar contrastes
→ encontrar a tensão principal → crenças populares envolvidas → contradições
→ mecanismos ocultos → possibilidades de carrossel → escolher UMA tese → descartar o resto
→ reconstruir em ordem narrativa
```

Um vídeo pode conter quatro excelentes carrosséis. Isso não autoriza um carrossel a conter os
quatro. Os outros vão para o backlog (`thesis-selection.md`).

## 3. `## Mapa da fonte` (no `editorial-report.md`)

Cada ideia com o tipo, a citação literal que a sustenta e a localização:

```markdown
## Mapa da fonte

Fonte: corpus:lE--NmXpw5o — "Todo sarcástico é um invejoso assustado" (falante: Diego)

| # | Tipo | Ideia (paráfrase curta) | Citação literal | Onde |
|---|---|---|---|---|
| 1 | tese | O sarcasmo protege quem tem medo de admirar | "…" | 03:12 |
| 2 | mecanismo | … | "…" | 05:40 |
| 3 | metáfora | … | "…" | 07:02 |
| 4 | objeção | … | "…" | 09:15 |

Frases com cara de Diego: "…", "…"
```

Tipos: `tese`, `mecanismo`, `causa`, `consequência`, `exemplo`, `metáfora`, `contraste`,
`objeção`, `crença popular`, `aplicação`. Separar afirmação de Diego, hipótese dele e inferência
editorial nossa (marcar esta última como `inferência`).

## 4. Briefing interno (quatro perguntas, antes de escrever)

| Pergunta | Ruim | Bom |
|---|---|---|
| **Objetivo** — o que deve acontecer intelectualmente com o leitor? | "Falar sobre carência." | "Fazer o leitor perceber que o problema não é ter necessidades afetivas, mas tentar satisfazê-las em fontes inadequadas." |
| **Público** — quem, descrito por comportamento | "Interessados em psicologia." | "Pessoas que checam mensagens, curtidas e sinais de aprovação compulsivamente e confundem atenção com vínculo." |
| **Ângulo** — a interpretação menos evidente | "Carência é ruim." | "A sede é legítima; o erro é beber água salgada." |
| **Promessa** — o que fica mais claro depois do último painel | "Entender carência." | "Distinguir o que alivia a falta do que a aprofunda." |

Gravar em `editorial.objective`, `audience`, `angle`, `promise`.

## 5. `## Diagnóstico` (cinco campos)

- **Forças** — o que já é naturalmente forte na fonte.
- **Oportunidades** — que ângulo teria mais curiosidade, identificação ou utilidade.
- **Vulnerabilidades** — onde o argumento pode parecer óbvio, injusto, difícil de defender, virar
  clichê, ser confundido com outro discurso (coach, red pill, autoajuda) ou exigir nuance.
- **Ideias ignoradas** — trechos aparentemente secundários que podem ser o verdadeiro carrossel.
  Com frequência a melhor ideia está aqui.
- **Raciocínios** — a cadeia lógica que transforma uma dessas ideias numa tese completa.

## Checklist

- [ ] Li a fonte inteira uma vez; o falante de cada citação é Diego.
- [ ] Nenhuma supervisão, conversa ou caso de terceiro.
- [ ] 10–30 ideias no mapa, cada uma com citação literal e localização.
- [ ] Metáforas, contrastes e objeções identificados.
- [ ] Briefing com objetivo, público, ângulo e promessa concretos.
- [ ] Diagnóstico com os cinco campos, incluindo ideias ignoradas.
