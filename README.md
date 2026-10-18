# Impostor TI

Um laboratório, uma palavra secreta, dez poderes e **um a três impostores**. Jogo de dedução social para uma turma de até **24 alunos individuais**, com o professor controlando a investigação em tempo real.

- **Jogar:** https://fernandobalbino.github.io/impostor-ti/
- **Servidor:** https://impostor-ti-api.onrender.com/health
- **Frontend:** React, TypeScript, Vite, Tailwind e Socket.IO Client, no GitHub Pages.
- **Backend:** Node.js, Express e Socket.IO, em uma única instância do Render.

![Impostor TI com 24 participantes simulados e seus nomes](docs/preview.png)

**Validação da versão com poderes:** 63 testes aprovados, telas conferidas em computador e celular e sessão pública de **30 minutos e 6 segundos** com 24 alunos simulados, professor e telão. Foram 33 partidas, 15.312 comandos e nenhuma falha detectada; latência p95 de **173 ms**. Resultados e limites em [docs/VALIDATION.md](docs/VALIDATION.md).

## Como jogar

1. O professor escolhe **Sou professor**, cria a sala e compartilha o código de seis caracteres.
2. Cada aluno escolhe **Jogar**, informa código e nome, personaliza o personagem, escolhe **dois poderes diferentes** e marca **Estou pronto**. Não é necessário cadastro.
3. O professor seleciona categorias, tempo, **1–3 impostores** e o modo de escolha, salva as configurações e inicia com todos conectados e prontos. Os mínimos são 3, 5 e 7 alunos, respectivamente.
4. Os civis recebem a palavra e a imagem. O impostor recebe somente a categoria e precisa blefar. Após seis segundos de revelação privada, todos os vivos podem escrever uma dica de até 80 caracteres.
5. A coleta termina ao esgotar o prazo ou quando todos respondem. A votação só começa quando o professor clica em **Abrir votação**.
6. Cada aluno vivo escolhe um suspeito e confirma um único voto secreto. Não pode votar em si mesmo. O professor encerra e revela a contagem.
7. O mais votado é eliminado. Um empate permite um desempate controlado pelo professor entre os empatados. Todos os vivos votam, sem voto próprio. Novo empate ou ausência de votos não elimina ninguém.
8. Se a partida continuar, o professor inicia outra rodada com a mesma palavra. Eliminados assistem sem dar dicas, votar ou ativar poderes. Civis vencem ao eliminar todos os impostores; impostores vencem quando igualam ou superam os civis vivos. Os aliados são sinalizados em vermelho somente para os impostores.

Os poderes ficam travados até o fim da partida: apenas uma ativação por rodada, recarga independente de quatro rodadas e Égide de uso único. O alvo recebe um aviso anônimo sobre o efeito. Consulte [poderes e regras completas](docs/POWERS.md).

Após o resultado, **Iniciar nova partida** volta ao lobby, preserva nomes e personagens, restaura os eliminados, limpa o histórico e exige nova preparação. A próxima palavra será diferente da anterior. Espectadores conectados podem ocupar vagas disponíveis na partida seguinte.

O botão de encerramento manual pede confirmação e encerra sem declarar um vencedor.

## Telão e privacidade

Use **Abrir telão para a turma**, no lobby do professor, para abrir `#/telao/CODIGO` em uma janela própria. O telão é público, somente para leitura e não ocupa uma vaga. Mostra nomes, dicas, conexões e votos encerrados. A palavra e o impostor só são revelados no fim.

**Não projete o painel privado do professor:** ele possui a palavra e uma consulta privada do impostor. O link do telão não leva a credencial administrativa e abre sem compartilhar a sessão da janela de origem.

O professor não conta como aluno. Todos jogam individualmente, sem equipes ou duplas. Entrada após o início fica bloqueada por padrão; quando habilitada, só permite assistir.

## Executar localmente

Requer Node.js 24 e npm. No diretório do projeto:

```sh
npm ci
npm run dev
```

Abra **http://localhost:5173/impostor-ti/**. O servidor escuta a porta 3001. `npm run dev` inicia os dois serviços. Para iniciar separadamente:

```sh
npm run dev -w @impostor/server
npm run dev -w @impostor/web
```

O Vite usa o subcaminho `/impostor-ti/` também em desenvolvimento. A navegação usa hash, permitindo atualizar salas e telão no GitHub Pages.

### Variáveis

Os exemplos estão em `apps/web/.env.example` e `apps/server/.env.example`. O frontend lê `apps/web/.env.local` pelo Vite. O backend lê variáveis do ambiente do processo; para um arquivo local, use `node --env-file=apps/server/.env ...` ou exporte as variáveis antes de iniciar.

| Serviço  | Variável          | Uso                                                          |
| -------- | ----------------- | ------------------------------------------------------------ |
| Frontend | `VITE_SOCKET_URL` | URL pública do servidor Socket.IO, sem `/socket.io` no final |
| Frontend | `VITE_API_URL`    | URL pública da API de saúde                                  |
| Backend  | `PORT`            | Porta HTTP fornecida pelo Render; 3001 localmente            |
| Backend  | `ALLOWED_ORIGINS` | Origens permitidas, separadas por vírgulas e sem caminho     |
| Backend  | `NODE_ENV`        | `production` no Render                                       |

As variáveis `VITE_` são públicas. Nunca coloque credenciais nelas. Os tokens de aluno e professor são gerados por criptografia no servidor e guardados apenas na `sessionStorage` da aba.

Para testar de outro computador da rede local, defina `VITE_SOCKET_URL` e `VITE_API_URL` com o IP do servidor e inclua a origem do frontend em `ALLOWED_ORIGINS`. Nenhuma sala, palavra ou credencial é persistida no disco.

## Testes e builds

```sh
npm run check
npm test
npm run build:server
npm run build:web
```

O frontend fica em `apps/web/dist`; o servidor, em `apps/server/dist/index.js`. Execute a versão compilada com `npm run start:server`.

Os testes cobrem a lógica principal e uma integração com 24 clientes Socket.IO, professor e telão, incluindo permissões, proteção da palavra, validação, votos secretos, empates, vitória, nova partida e reconexão.

### Sessão contínua com 24 clientes

```sh
TEST_URL=https://impostor-ti-api.onrender.com LOAD_MINUTES=30 npm run test:load
```

No PowerShell:

```powershell
$env:TEST_URL='https://impostor-ti-api.onrender.com'
$env:LOAD_MINUTES='30'
npm run test:load
```

O script mantém 24 alunos, professor e telão, joga repetidas partidas de duas rodadas, elimina um civil antes do impostor, verifica votos e fases e reconecta um aluno periodicamente. Gera `qa-evidence/load-report.json`, sem tokens. A simulação mede o protocolo e a comunicação; não substitui uma aula real com 24 Chromebooks e a rede da escola.

## Publicar no GitHub Pages

O workflow da branch `main` instala dependências, verifica TypeScript, executa testes e compila os dois serviços antes de publicar o frontend. Em **Settings → Pages**, selecione **GitHub Actions**. Em **Settings → Secrets and variables → Actions → Variables**, configure `VITE_API_URL` e `VITE_SOCKET_URL` com a URL real retornada pelo Render.

O `base` do Vite está em `/impostor-ti/`. Ao mudar o nome do repositório, ajuste esse valor e a origem permitida se o domínio mudar. Imagens, fontes, sprites e ícones são locais. O jogo precisa de internet para a partida multiplayer; não oferece partida offline.

## Publicar no Render

Crie um Web Service Node a partir deste repositório ou utilize `render.yaml` como Blueprint:

| Opção            | Valor                                          |
| ---------------- | ---------------------------------------------- |
| Branch           | `main`                                         |
| Região / plano   | Virginia / Free                                |
| Diretório raiz   | Raiz do repositório                            |
| Build            | `npm ci --include=dev && npm run build:server` |
| Iniciar          | `npm run start:server`                         |
| Saúde            | `/health`                                      |
| Instâncias       | 1                                              |
| Origem permitida | `https://fernandobalbino.github.io`            |

Configure `NODE_ENV=production`, `NODE_VERSION=24` e `ALLOWED_ORIGINS`. O backend usa `process.env.PORT` e `0.0.0.0`. O Render termina TLS e permite conexões Socket.IO por HTTPS/WSS. A origem é verificada também no handshake WebSocket, além do CORS de HTTP.

Não aplique o Blueprint uma segunda vez para criar outro serviço se já tiver criado o serviço por outra forma. Após publicar, verifique `/health` e uma partida real pelo Pages. Alterações de backend e reinicializações encerram as salas atuais; publique fora do horário de aula.

## Reconexão e limitações

- Uma queda breve mostra **Reconectando…**. A sessão recupera nome, avatar, papel, dica e voto, sem criar outra pessoa. Atualizar a mesma aba mantém a identidade.
- Fechar a aba, apagar seus dados ou perder o token pode impedir a recuperação. Não existe conta nem recuperação de credencial administrativa fora da sessão da aba.
- As salas ficam apenas na memória. Um reinício, deploy ou suspensão encerra as partidas. A interface explica que é necessário criar uma nova sala.
- O plano gratuito pode demorar cerca de um minuto para despertar após inatividade e compartilha a franquia de horas gratuitas com outros serviços do workspace. Consulte as [limitações oficiais do Render](https://render.com/docs/free).
- Salas sem professor nem alunos conectados são removidas após 30 minutos. Alunos desconectados mantêm suas vagas durante a partida.
- Os arquivos de imagens são públicos. O segredo depende do sorteio no servidor e da entrega privada; o impostor não recebe o ID ou o caminho do item sorteado.
- Professor e alunos veem apenas a quantidade de votos confirmados durante a votação. A contagem por suspeito aparece somente no encerramento; escolhas individuais não são publicadas.

## Conteúdo e recursos

O catálogo possui 60 termos: 24 de hardware, 16 de software, seis navegadores, sete sistemas operacionais e sete conceitos básicos. O banco de palavras é importado apenas pelo servidor; o pacote compartilhado contém contratos e categorias.

As imagens de equipamentos vieram do [CentralJogos](https://github.com/FernandoBalbino/CentralJogos), conforme solicitado. Cenário, personagens e ilustrações adicionais foram produzidos para este projeto. Créditos, licenças e prompts estão em `docs/ASSETS.md`. Os resultados efetivamente executados ficam registrados em `docs/VALIDATION.md`.
