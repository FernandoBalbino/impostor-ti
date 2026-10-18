# Poderes e partidas com vários impostores

Cada aluno escolhe dois poderes diferentes abaixo dos personagens, antes de ficar pronto. A seleção é privada e fica travada durante a partida. Alterar os poderes no lobby desfaz a preparação.

É possível ativar apenas um poder por rodada, incluindo os desempates. Cada poder tem sua própria recarga: se usado na rodada 1, volta na 5. Uma tentativa absorvida por barreira ou uma leitura fracassada também gasta a ativação. Cancelamentos, alvos inválidos e efeitos já ativos não gastam o poder.

| Poder | Efeito |
| --- | --- |
| Silêncio do Inocente | Bloqueia a escrita e o envio de outro aluno por 20 segundos, preservando o rascunho. |
| Letra do Abismo | Sorteia uma letra de A–Z proibida na próxima dica verdadeira; variações acentuadas também contam. |
| Égide do Destino | Protege você ou um colega da próxima eliminação. O escudo quebra e ninguém é eliminado. Uma ativação por partida. |
| Peso da Verdade | Seu voto vale dois nesta rodada, incluindo os desempates. Ative antes de confirmar o voto. |
| Exílio do Veredito | Outro aluno fica sem votar nesta rodada e nos desempates. Não apaga votos já confirmados. |
| Oráculo da Dúvida | Tem 50% de chance de revelar em segredo o papel verdadeiro de outro aluno. Falhar também consome a tentativa. |
| Eco Apócrifo | Coloca uma dica falsa no nome de quem ainda não respondeu. A dica verdadeira substitui a falsa. |
| Refúgio Estoico | Protege você do próximo poder hostil. Permanece até absorver um ataque e não bloqueia a Égide. |
| Tábula Rasa | Apaga uma dica verdadeira e abre 20 segundos de reenvio somente para o alvo. |
| Véu de Platão | Esconde somente a imagem do item de outro aluno na próxima rodada, mantendo o nome da palavra. |

Silêncio, Letra, Eco e Tábula Rasa só podem ser ativados durante o prazo normal das dicas. Os demais funcionam nas etapas de dicas, conversa, votação e preparação do desempate, respeitando as ações que já aconteceram. Revelação de papéis, contagem encerrada e fim de jogo não aceitam ativações.

Efeitos diferentes podem coexistir; repetir um efeito ativo não acumula tempo, letras, escudos ou dicas falsas. Uma defesa não desfaz um ataque anterior. As proteções, quando consumidas, não gastam a ativação da rodada do protegido.

A dica falsa não confirma a resposta verdadeira nem encerra a coleta. No prazo extra da Tábula Rasa, só os alvos pendentes podem reenviar e novos ataques sobre dicas ficam bloqueados. Se houver silêncio, o prazo de reenvio termina 20 segundos depois dele. A votação aguarda esses reenvios ou seus prazos, inclusive quando o professor encerra a coleta normal.

Usuário e alvo recebem avisos privados com nome e efeito do poder, sem identificar o autor para a vítima. A escolha de poderes, os resultados do Oráculo e os estados privados não entram nos pacotes públicos. Reconectar ou atualizar não limpa recargas ou penalidades.

## Um, dois ou três impostores

O professor escolhe a quantidade e pode sortear ou selecionar em segredo os participantes. Os mínimos são três, cinco e sete alunos, respectivamente. Impostores identificam seus aliados por balões vermelhos e um marcador de texto, visíveis somente para eles.

Civis vencem ao eliminar todos os impostores. Impostores vencem quando igualam ou superam a quantidade de civis vivos. Uma Égide que evita uma eliminação não transfere a eliminação para o segundo colocado; a partida continua. Empates só consomem o escudo se um desempate posterior realmente eliminaria seu protegido.

## Recursos e rede

Os dez sprites foram gerados individualmente com Image Gen. PNG originais: `docs/power-sprites/`. Versões de 128×128 em WebP sem perdas e com transparência: `apps/web/public/assets/powers/`. Prompts em [IMAGE-PROMPTS.md](IMAGE-PROMPTS.md). As dez versões de jogo somam aproximadamente 136 KB e são servidas pelo GitHub Pages.

As regras são validadas no servidor. Cada pedido possui um identificador cujo resultado é preservado por sessão; repetir uma ativação devolve o resultado anterior, sem cobrar ou sortear novamente. Notificações usam sequências individuais e são recuperadas sem exibições repetidas após atualizar a aba.

Mudanças públicas próximas são agrupadas em até 20 ms; transições de fase são imediatas. Atualizações privadas de poderes vão somente aos envolvidos. O servidor agenda prazos por sala e os navegadores desenham os contadores localmente. Sprites e animações não trafegam pelo Socket.IO. A compressão WebSocket permanece desativada.

O protocolo 2 identifica clientes antigos com uma mensagem para atualizar a página. A rota `/health` informa protocolo, revisão do backend e métricas agregadas de memória, CPU, conexões, comandos e atraso do processamento, sem tokens ou estados de jogadores.

Referências consultadas: [entrega de mensagens](https://socket.io/docs/v4/delivery-guarantees/), [otimização do Socket.IO](https://socket.io/docs/v4/performance-tuning/), [compressão WebSocket](https://socket.io/docs/v4/server-options/#permessagedeflate), [WebSockets no Render](https://render.com/docs/websocket), [deploys](https://render.com/docs/deploys) e [health checks](https://render.com/docs/health-checks).

## Repetir a carga

```powershell
$env:TEST_URL='https://impostor-ti-api.onrender.com'
$env:LOAD_MINUTES='30'
$env:LOAD_REPORT='qa-evidence/powers/public-load-30min.json'
npm run test:load:powers
```

O script mantém 24 alunos, professor e telão, alterna os dez poderes e 1–3 impostores, repete comandos e reconexões e verifica resultados de votos. Inclui rajadas de 24 ativações, conflitos pelo mesmo alvo, recargas e proteções. A aprovação exige sessão concluída, ausência de quedas inesperadas, p95 de confirmação até 1,5 segundo e máxima até 5 segundos. Os resultados desta versão são registrados em [VALIDATION.md](VALIDATION.md).

O Render atual continua com uma instância e salas em memória. A recuperação cobre quedas breves da conexão, enquanto o processo existe. Reinício ou deploy do backend encerra as salas; a validação com clientes simulados não substitui a rede e os Chromebooks de uma aula presencial.
