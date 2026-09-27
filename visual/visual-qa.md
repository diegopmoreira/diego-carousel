# Revisão visual

Abrir `qa/contact-sheet.png` e **cada** PNG de `qa/render/` no tamanho real. Conferir:

- leitura, hierarquia, acentos (ver também `qa/ink/NN.png` e os avisos do render);
- margens, alinhamento, dead space acidental, elementos competindo com o título;
- imagem: associação com a ideia, crop, rosto cortado, texto dentro da imagem (proibido);
- ritmo entre painéis (nada de dez layouts iguais), densidade (nunca tudo HIGH);
- rodapé: cue presente até o antepenúltimo, CTA com ícone no penúltimo, nada no último;
- perfil só na capa; capa A sem rodapé.

Gates automáticos (render/validate): fit, pisos, geometria e margens, fontes efetivas via CDP (sem
fallback), requests, console, dimensão, hashes, mapa de tinta. Aprovação técnica não aprova o
conceito visual.

Registrar cada inspeção: `review <projeto> --reviewer Claude --note "…" [--approved]`. Máximo de
`qa.max_auto_revision_cycles` ciclos automáticos; depois, revisão humana. Nunca registrar sem abrir
as imagens.
