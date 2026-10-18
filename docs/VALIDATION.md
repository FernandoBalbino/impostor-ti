# Validação — Impostor TI

## Versão 2.2 — vinte poderes, três escolhas e abstenção — 18/10/2026

- TypeScript, builds e **93/93 testes** aprovados. A cobertura inclui os vinte poderes, três escolhas privadas, Pandora e recarga de duas rodadas, suspensão por espaço, curas, proteções, letras acentuadas, nomes, votos ponderados e abstenção normal e no desempate.
- Integração Socket.IO real confere visões individuais, remoção de dicas do histórico e da reconexão, Confusão privada, restauração da própria resposta e atualização de snapshots repetidos. Nenhum dado bloqueado depende apenas de ocultação na interface.
- Navegador local em **1366×768 e 390×844**: vinte sprites, três escolhas obrigatórias, alteração desfazendo preparação, quatro ícones do impostor, transformação de Pandora preservando suspensão, contagem 2→1, escrita por Enter durante avisos, cancelamento e confirmação de abstenção por teclado e toque, recuperação após atualizar, ranking animado com abstenção separada, cegueira do histórico e nomes embaralhados somente para o alvo. Sem transbordamento horizontal ou erros do aplicativo; um erro de extensão do navegador foi separado da análise.
- Conferência no site público final com 24 alunos, incluindo dois navegadores reais: seleção de três, ativação de Pandora e confirmação de abstenção. Nomes e detalhes dos poderes usam **Nunito** nos dois tamanhos; os demais títulos continuam em Pixelify. [Relatório do navegador](strategic-browser.json) e [imagem da fonte no celular](power-font-mobile.png).
- **78 recursos distintos**, incluindo os 21 sprites de poderes, conferidos no Pages por HTTP e SHA-256 sem ausências ou divergências. [Relatório dos recursos](strategic-public-assets.json).
- Frontend e backend publicados na mesma revisão de execução **`cec06ee`**, versão `2.2.0` / protocolo `4`. GitHub Actions [39153891939](https://github.com/FernandoBalbino/impostor-ti/actions/runs/39153891939) aprovado e deploy Render `dep-dbagt22jnfac73fludog` confirmado **live**. A atualização precedeu a sessão de carga; não houve deploy ou reinício durante a medição. Mantidos Render Free, uma instância e GitHub Pages.

### Sessão pública contínua final

Executada em **18/10/2026, de 15:34:19 a 16:04:53**, horário de Fortaleza (UTC−3), contra o backend público. Foram mantidos 24 alunos simulados, professor e telão, com as mesmas identidades. A revisão `cec06ee` foi conferida continuamente pelo endpoint de saúde.

| Medida                                                              |                              Resultado |
| ------------------------------------------------------------------- | -------------------------------------: |
| Duração monotônica                                                  | **1.833,901 segundos — 30 min e 34 s** |
| Partidas completas / rodadas                                        |                           **43 / 304** |
| Rajadas de 24 tentativas simultâneas                                |                                 **84** |
| Ativações válidas dos vinte poderes                                 |                              **1.772** |
| Reconexões programadas                                              |                                 **50** |
| Reenvios com o mesmo identificador                                  |                                **123** |
| Respostas de votação / abstenções                                   |                      **7.141 / 5.153** |
| Comandos confirmados, incluindo recusas esperadas                   |                             **19.912** |
| Latência mediana / p95 / máxima                                     |           **160,9 / 172,8 / 495,6 ms** |
| Quedas inesperadas, cobranças duplicadas ou divergências detectadas |                                  **0** |
| Erros nos logs do Render durante a janela consultada                |                                  **0** |

O relatório terminou com **`completed: true` e `errors: []`**: [dados completos](public-strategic-load-30min.json). A confirmação p95 ficou abaixo de 1,5 segundo e a máxima abaixo de 5 segundos. Os tempos medem ida e volta até o ACK Socket.IO, com relógio monotônico neste computador, incluindo a rede. A sessão foi encerrada após concluir a última partida, por isso ultrapassou os 30 minutos solicitados.

O simulador alternou 1–3 impostores, percorreu os vinte poderes duas vezes e repetiu parte do catálogo. Conferiu recarga na rodada correta, limite compartilhado, uso único da Égide, sorteios idempotentes, conflitos por alvo, curas, suspensão, Pandora, votos com pesos registrados e rodadas com todos pulando. Cada partida terminou com a vitória civil somente após eliminar todos os impostores. Casos específicos de desempate e confirmações atrasadas também estão cobertos pelos testes de regras e integração.

As recusas esperadas foram `POWER_SUSPENDED` (26), `ONE_POWER_PER_ROUND` (48), `POWER_SPENT` (48), `EFFECT_ACTIVE` (166) e `INVALID_TARGET` (4). Não entram como falhas: o script exigiu a recusa correta sem cobrança indevida. As ativações absorvidas por uma barreira seguem a regra de consumir uso e recarga.

Uma tentativa preliminar foi interrompida antes desta sessão: o simulador começou a preencher dicas usando, para um cliente, a confirmação privada da rodada anterior. O servidor permaneceu na coleta aguardando a dica que o simulador havia omitido. O script passou a aguardar tanto a fase pública quanto o prazo e o estado privados da nova rodada. Essa tentativa parcial não integra a duração nem os números aprovados e não exigiu alteração do aplicativo publicado. A execução final usou `LOAD_PROFILE_OFFSET=16` e cronômetros normais, sem `LOAD_FAST`.

### Recursos e limites da evidência

As **63 amostras** de saúde registraram RSS de **88,7–99,5 MB**, heap de **18,3–28,1 MB** e p95 do atraso do event loop de **20,20–20,28 ms**. O histograma de processamento é cumulativo e usa resolução de 20 ms; não representa a latência de confirmação dos comandos.

As métricas do Render, em janelas de 60 segundos entre 18:34:19 e 19:05:00 UTC, registraram maior amostra de CPU de **0,01312**, cerca de **8,7%** do limite `0,15`, e memória de **116,2 MB**, cerca de **21,6%** do limite de 536,9 MB. São amostras agregadas da plataforma. [Métricas](strategic-render-metrics.json) e [consulta de logs](strategic-render-logs.json).

O endpoint de saúde compartilhado registrou 27–29 transportes: os 26 clientes lógicos do teste, uma conexão externa ao simulador e sobreposições breves nas reconexões programadas. As verificações exigiram sempre 24 identidades únicas de alunos na sala. Após encerrar a carga, restou uma conexão no serviço.

Esta evidência cobre clientes simulados e as sessões de navegador descritas acima; não substitui uma aula com 24 Chromebooks nem mede o Wi-Fi escolar. Salas continuam em memória e não sobrevivem a reinício ou deploy do Render. A análise posterior do Cloudflare e sua configuração gratuita estão em [CLOUDFLARE.md](CLOUDFLARE.md); não houve migração de hospedagem nesta publicação.

## Versão 2.1 — Vestígio do Invisível e ranking animado

- TypeScript, builds e **70/70 testes** aprovados. A regressão cobre todas as regras anteriores de voto e revelação.
- Vestígio automático para cada impostor, ausente do lobby, sem ocupar as duas escolhas; civis impedidos pelo servidor; somente a primeira letra, incluindo acentos, entregue em segredo. Recarga 1→5, limite compartilhado por rodada, reconexão idempotente e limpeza na nova partida.
- Ranking filtra zero votos, ordena contagens ponderadas sem modificar o resultado, conserva posições empatadas e usa larguras e durações proporcionais aos votos. Mantidos `closeVote`, os tempos das fases, a eliminação, o escudo e a revelação final.
- Navegador local com 24 alunos, professor e telão: modal nas quatro interfaces, empate 12/12, desempate 15/9, escudo preservando o jogador, 24 participantes votados com rolagem, votação vazia, recarga completa do Vestígio e revelação final. Sem erros de console ou transbordamento em 1366×768 e 390×844; teclado, toque e movimento reduzido conferidos.
- A animação foi medida no navegador: escala inicial **0**, crescimento intermediário e escala final **1**. Empatados tiveram duração igual de 1,8 s; 15 e 9 votos tiveram durações de 1,8 e 1,08 s. Relatório local: `qa-evidence/vestige-ranking/local-browser.json`.
- Revisão `ed937cd` publicada no GitHub Pages e no Render, versão `2.1.0` / protocolo `3`. GitHub Actions [39139676672](https://github.com/FernandoBalbino/impostor-ti/actions/runs/39139676672) aprovado; deploy Render `dep-dbae57lg1s2s73bouob0` confirmado **live**. Backend atualizado sem jogadores conectados.
- Fluxo completo repetido no site público com 24 alunos simulados, professor e telão: **15 verificações aprovadas**, quatro layouts sem cortes ou transbordamento, zero erros de console. Abertura dos quatro modais observados com diferença de 5 ms; barra medida em escala 0, 0,062, 0,376 e 1 durante o preenchimento. [Relatório público](vestige-ranking-browser.json).
- **68 recursos públicos**, incluindo os 11 sprites (dez selecionáveis e um exclusivo), conferidos por HTTP e SHA-256 sem ausências ou divergências: [relatório](vestige-ranking-assets.json).
- A sessão de 30 minutos abaixo pertence à versão 2.0; não foi repetida para esta alteração.

## Histórico — versão 2.0: poderes e até três impostores — 18/10/2026

- TypeScript, **63/63 testes** e builds do frontend e servidor aprovados localmente.
- Novos testes cobrem os dez poderes, recargas, tentativa fracassada, barreiras, escudo de uso único, reescrita com silêncio, dicas falsas, votos dobrados e impedidos, 1–3 impostores, privacidade, reconexão e reenvio idempotente.
- Integração real com 24 alunos, professor e telão verifica 24 ativações simultâneas, absorção de ataques, notificações anônimas e restauração sem cobrança duplicada.
- Navegador local: os dez poderes ativados pela interface, escolha obrigatória de dois poderes, três impostores selecionados pelo professor, aliados privados, rascunho preservado, voto no celular, escudo impedindo eliminação, imagem oculta na próxima rodada e vitória após eliminar os três impostores.
- Layouts 1366×768 e 390×844, sem transbordamento horizontal, imagens quebradas ou erros de console. Campo de escrita visível nos dois tamanhos. Relatório local: `qa-evidence/powers/local-browser-report.json`.
- Fluxo repetido no GitHub Pages com o backend público, incluindo os dez poderes pela interface, proteção contra eliminação e vitória após eliminar três impostores: [relatório público do navegador](powers-browser.json).
- Fila pública: atualizar a página recupera avisos que ainda aguardavam exibição, sem repetir os já mostrados: [relatório](powers-notices.json). Teclado, toque, cancelamento sem consumo e preferência de movimento reduzido conferidos localmente na mesma interface: [relatório](powers-inputs.json).
- **60 palavras, 57 imagens de itens e dez sprites de poderes** conferidos no Pages por HTTP e SHA-256: 67 arquivos, nenhum ausente ou divergente. [Relatório dos recursos](powers-public-assets.json).
- GitHub Actions [39131470616](https://github.com/FernandoBalbino/impostor-ti/actions/runs/39131470616) e [39131837469](https://github.com/FernandoBalbino/impostor-ti/actions/runs/39131837469) concluídos com sucesso. Frontend `30952e9`; backend `0039a9b`, ambos versão funcional 2 / protocolo 2. O segundo commit ajusta somente a fila no frontend e a simulação de carga.
- Render `dep-dbaci7rrjlhs739og2f0` confirmado **live**, `/health` com versão `2.0.0`, protocolo `2` e revisão `0039a9b`. Foi necessário iniciar manualmente o deploy do serviço existente, cuja origem é a URL pública do repositório. Mantidos plano Free e uma instância, sem novos serviços.
- A nova sessão pública abaixo valida esta versão com poderes. A carga histórica de 17/10 permanece separada.

### Sessão pública contínua com poderes

Executada em **18/10/2026**, de **10:40:29 a 11:10:35**, horário de Fortaleza (UTC−3), contra `https://impostor-ti-api.onrender.com`. Foram mantidos 24 alunos simulados, professor e telão, com as mesmas identidades durante toda a sessão. Backend e frontend permaneceram nas revisões indicadas acima, sem deploy ou reinício durante a medição.

| Medida                                                               |                                             Resultado |
| -------------------------------------------------------------------- | ----------------------------------------------------: |
| Duração exata                                                        | **1.805,806 segundos** — aproximadamente 30 min e 6 s |
| Partidas completas / rodadas                                         |                                          **33 / 216** |
| Rajadas com 24 tentativas simultâneas                                |                                               **105** |
| Ativações válidas dos dez poderes                                    |                                             **2.370** |
| Reconexões programadas                                               |                                                **25** |
| Reenvios com o mesmo identificador                                   |                                               **124** |
| Comandos confirmados, incluindo recusas esperadas e reenvios         |                                            **15.312** |
| Latência mediana / p95 / máxima                                      |                          **158,3 / 172,7 / 934,1 ms** |
| Desconexões inesperadas, cobrança duplicada ou divergência detectada |                                                 **0** |
| Erros nos logs do Render, janela 13:40–14:11 UTC                     |                                                 **0** |

O relatório terminou com **`completed: true` e `errors: []`**: [dados completos da carga](public-powers-load-30min.json). A confirmação p95 ficou abaixo de 1,5 segundo e a máxima abaixo de 5 segundos. Os tempos são ida e volta até o ACK Socket.IO, medidos com relógio monotônico no computador de teste, incluindo a rede até Virginia.

Cada partida alternou 1, 2 ou 3 impostores. O script conferiu resultados de votos ponderados, todos impedidos de votar, desempates, escudos impedindo eliminações e vitória somente após eliminar todos os impostores. As rajadas exercitaram os dez poderes, recarga na rodada 5, uso único da Égide, absorção por Refúgio, silêncio real de 20 segundos, letras proibidas, substituição de dicas falsas e reescrita após encerramento do prazo normal.

As disputas pela mesma dica produziram **seis recusas `INVALID_TARGET` esperadas**, sem cobrar a segunda tentativa. As **144 recusas `POWER_SPENT`** conferiram a Égide já consumida. O teste também tentou um segundo poder na mesma rodada, conferiu a recusa sem gasto e repetiu comandos antes e depois de reconectar, exigindo o mesmo resultado sem novo sorteio. Escolhas, efeitos e estados privados foram recuperados; autor dos ataques e resultados privados não apareceram nos pacotes públicos.

Os 26 clientes lógicos permaneceram na sala. Algumas amostras de saúde registraram 27 transportes durante a sobreposição breve do fechamento e abertura nas reconexões programadas; não houve aluno extra nem duplicação de identidade. As tentativas preliminares interrompidas não entram nesta duração ou nos resultados. Elas corrigiram o simulador para aguardar atualizações agrupadas e usar os horários do servidor ao conferir prazos; não exigiram mudança no backend publicado. A execução completa usou `LOAD_PROFILE_OFFSET=3` para começar por Eco/Tábula e depois percorrer todo o catálogo.

### Memória, CPU e processamento

As 32 amostras de `/health` durante a execução registraram RSS de **90,1–97,9 MB**, heap de **19,6–25,0 MB** e p95 do atraso do event loop de **20,22–20,25 ms**. O histograma é cumulativo desde o início do processo e usa resolução de 20 ms; essa medida não é a latência de confirmação dos poderes.

As métricas do Render, em janelas de 60 segundos de 13:40 a 14:11 UTC, registraram pico de média de CPU de **0,00910 vCPU**, aproximadamente **6,1%** do limite de 0,15 vCPU informado pela plataforma. A maior amostra de memória do serviço foi **101,6 MB**, cerca de **18,9%** do limite de 536,9 MB. São amostras agregadas, não máximas instantâneas. [Métricas do Render](powers-render-metrics.json) e [consulta dos logs](powers-render-logs.json).

Esta evidência cobre clientes Socket.IO simulados e as sessões de navegador descritas acima. Não houve aula presencial com 24 Chromebooks; a qualidade do Wi-Fi escolar e futuras indisponibilidades do Render continuam fora desta medição. As salas permanecem em memória e não sobrevivem a reinício ou deploy do backend.

## Validação histórica — versão sem poderes

Verificações concluídas em **17/10/2026**. Frontend verificado: `ae3f467`; backend: `44a1092`, com `/health` configurado no Render. Este registro histórico se refere à versão anterior aos poderes.

## Código e integração

- `npm run check`: aprovado.
- `npm test`: **27/27 testes aprovados**, incluindo uma integração com 24 alunos, professor e telão em conexões Socket.IO reais.
- Builds do servidor e frontend: aprovados localmente e no GitHub Actions.
- `render.yaml`: aprovado pelo JSON Schema oficial do Render, usando Ajv 2020. O CLI do Render não estava instalado; não foi executada validação por CLI.
- A integração verificou palavra, ID e imagem ausentes das mensagens privadas do impostor e das mensagens do telão antes do resultado; votos secretos e únicos; proibição de voto próprio e comandos administrativos de aluno/telão; rejeição de origem WebSocket indevida; reconexão sem duplicação e nova partida.
- Testes de regras cobriram o prazo automático sem mensagens dos alunos, fim por todas as respostas, empate e desempate, continuidade após eliminar um civil, as duas vitórias, bloqueio de eliminados e idempotência.

## Sessão contínua no servidor público

Executada contra **https://impostor-ti-api.onrender.com**, com 24 alunos simulados, um professor e um telão: **26 conexões**. Intervalo: **17:57:24 a 18:27:45**, horário de Fortaleza (UTC−3).

| Medida                           |                    Resultado |
| -------------------------------- | ---------------------------: |
| Duração total                    | **30 minutos e 21 segundos** |
| Partidas completas               |                       **79** |
| Rodadas completas                |                      **158** |
| Reconexões programadas           |                       **27** |
| Comandos confirmados             |                   **10.006** |
| Eventos recebidos pelos clientes |                  **268.644** |
| Latência mediana dos comandos    |                   **161 ms** |
| Latência p95 dos comandos        |                   **411 ms** |
| Maior latência observada         |                 **1.546 ms** |
| Falhas detectadas                |                        **0** |

Cada partida eliminou um civil, continuou com a mesma palavra e terminou ao eliminar o impostor. Foram conferidos os 24 participantes, ausência de duplicações, sincronização de fases e contagens dos votos. A reconexão preservou a identidade. O teste rejeitaria uma desconexão não programada; nenhuma ocorreu. O encerramento foi normal, com `completed: true`.

O relatório de execução está em [public-load-30min.json](public-load-30min.json). As medições de latência são o tempo de ida e volta até a confirmação Socket.IO, incluindo a rede entre o computador de teste e Virginia.

Também foram consultados os logs de erro do serviço no período, sem entradas de erro. Na amostragem de recursos durante a sessão, a maior memória registrada foi aproximadamente **70,4 MiB**; a amostragem também incluiu a sala adicional de verificação visual. Esses números descrevem esta execução e não são um limite de capacidade.

## Navegador e recursos públicos

Verificação no GitHub Pages com backend real, em **1366×768** e **390×844**, sem transbordamento horizontal:

- Criação de sala, nomes com acentos, escolha e alteração de personagem, preparação e os 24 nomes/avatares no painel.
- Tela privada do impostor sem palavra/imagem; telão sem palavra, imagem ou controles administrativos antes do encerramento.
- Dica por Enter, fim por todos responderem e espera pela abertura manual da votação.
- Seleção e confirmação do voto no celular, contagem secreta até o encerramento e dicas consultáveis durante a votação.
- Empate entre dois alunos, seleção restrita aos empatados no desempate e segundo empate sem eliminação.
- Eliminação de civil sem encerrar a partida, nova rodada com a mesma palavra e aluno eliminado assistindo sem campo de dica nem opção de voto.
- Vitória dos civis ao eliminar o impostor; vitória do impostor ao restarem exatamente dois sobreviventes; encerramento manual sem vencedor.
- Histórico de dicas, votos e eliminações; nova partida com nomes e personagens preservados; recuperação da sessão após atualizar a aba, sem duplicar aluno nem apagar a dica enviada.
- CSS, JavaScript, fontes, avatares e cenário carregados no subcaminho do Pages. Cenário e sprites em WebP sem perdas, com pixels visíveis conferidos contra os PNG originais.
- **60 palavras e 57 imagens distintas** verificadas por HTTP e comparação SHA-256 com os arquivos locais: nenhuma ausente ou divergente.
- Consoles dos perfis de professor, civil, impostor e telão sem erros ou avisos na revisão final.

Captura com participantes simulados:

![Painel de dicas com 24 nomes e personagens](preview.png)

Os relatórios detalhados de navegador, recursos, otimização e métricas, além das capturas, estão na pasta local `qa-evidence/`, preservada fora do versionamento. O teste de protocolo pode ser repetido com as instruções do README.

## Limites desta evidência

O teste prolongado usou clientes Socket.IO simulados. As telas foram verificadas em sessões reais de navegador, mas **não houve uma aula presencial com 24 Chromebooks e a rede escolar**. O teste não garante ausência de futuras quedas nem valida a qualidade do Wi-Fi da escola.

O Render gratuito pode suspender ou reiniciar o serviço. Como as salas ficam apenas na memória, esses eventos encerram as partidas; a recuperação por token atende quedas de conexão enquanto a sala ainda existe. Não há suporte a partidas offline ou a múltiplas instâncias sem sincronização.
