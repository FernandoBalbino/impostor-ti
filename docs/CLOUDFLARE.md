# Cloudflare: análise gratuita de latência

Em 18/10/2026, foram instaladas as 19 skills oficiais de `cloudflare/skills` e registrado o MCP oficial `https://mcp.cloudflare.com/mcp` no Codex. O login OAuth foi concluído com acesso de leitura à conta, scripts, logs e observabilidade de Workers. O painel da conta mostrou **Free** como plano atual. Nenhum plano pago foi ativado.

O MCP oficial de documentação também foi consultado por Streamable HTTP. A integração de administração registrada fica disponível ao carregar novamente os servidores MCP no Codex. A instalação não altera a hospedagem nem a latência do jogo por si só.

## O que foi medido

Uma comparação de dez requisições HTTP por destino, neste computador, registrou mediana aquecida de aproximadamente **179 ms** no `/health` do Impostor TI no Render e **62 ms** no `/health` de um Worker já existente, de outro jogo. A primeira requisição de cada destino foi excluída dessa mediana. [Dados da comparação](cloudflare-http-comparison.json).

Essa comparação mede endpoints diferentes. O endpoint do Worker responde diretamente, sem consultar a sala em um Durable Object; portanto, **não comprova uma redução na confirmação de poderes ou votos após uma migração**. Os dois destinos responderam com cabeçalho `cf-ray`; acrescentar um proxy não elimina o trajeto até o servidor que mantém a sala.

## Opções e limites

- Workers Free e Durable Objects com armazenamento SQLite têm franquias gratuitas. No Free, atingir um limite faz as operações correspondentes falharem até a renovação da franquia; não se deve tratar a cota como capacidade ilimitada. [Limites e preços oficiais](https://developers.cloudflare.com/durable-objects/platform/pricing/).
- Durable Objects coordenam o estado de cada sala e os WebSockets, mas a documentação atual informa que a dica de localização `sam` ainda encaminha objetos para o leste da América do Norte. Assim, não há garantia de executar a sala no Brasil. [Localização oficial](https://developers.cloudflare.com/durable-objects/reference/data-location/).
- Uma migração exigiria adaptar transporte, persistência, agendamentos e reconexão, preservar a privacidade dos vinte poderes e repetir a validação de carga. O ganho precisa ser medido em comandos reais antes de trocar a versão pública.

O Impostor TI permanece no Render Free e no GitHub Pages durante essa análise. Não foram ativados serviços pagos do Cloudflare, assinaturas, domínios, Containers ou upgrades. O guia usado na instalação foi o [Agent Setup oficial](https://developers.cloudflare.com/agent-setup/prompt.md).
