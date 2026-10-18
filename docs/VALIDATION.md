# Validação — Impostor TI

## Poderes e até três impostores — 18/10/2026

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
