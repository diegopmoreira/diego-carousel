Corpus sintético para testes do leitor `corpus:<id>`. Nenhum texto aqui é de Diego.
Formato conferido contra o export real (`transcricoes/<id>/v1.json`): `video_id`, `modelo`, `texto`,
`segmentos` só com tempos (`inicio_s`, `fim_s` e estatísticas do Whisper) e `palavras`
(`word`, `start`, `end`, `probability`). O texto de cada segmento é reconstruído pelas palavras.
Título, tipo, visibilidade e falantes vêm do `corpus.db` (tabela `video`/`segment`); aqui,
`catalogo.json` faz esse papel.
