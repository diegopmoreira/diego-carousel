# Provider: Higgsfield (MCP)

Gateway de modelos de imagem, usado pelo Claude via MCP. Declarado em `.mcp.json`
(`https://mcp.higgsfield.ai/mcp`), sem segredo no repositório. **Login OAuth feito por Diego na
máquina local** (`/mcp` no Claude Code → higgsfield → autenticar). Na nuvem ele não está disponível.

1. `asset request` → copiar `prompt`, `negative`, `aspect`/`size` e `variants` do pedido.
2. Listar as ferramentas do servidor (`/mcp`) e usar a de geração de imagem estática. Preferir
   modelos fotográficos; gpt-image também está disponível dentro do próprio Higgsfield.
3. Pedir exatamente `variants` imagens na proporção do pedido (ou a mais próxima suportada; o render
   recorta com `object-fit`).
4. Para cada resultado: abrir e conferir (sem texto, sem pessoa real reconhecível); registrar na hora
   com `asset add --request <pedido> --url <url> --model <modelo> [--seed …]`.
5. Custo: anotar créditos consumidos em `--params '{"credits": N}'` quando o provider informar.

Se o MCP não responder, não improvisar outro provider pago: registrar no `run.log` e deixar o
placeholder (o export espera).
