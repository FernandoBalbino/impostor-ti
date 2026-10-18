// Disposable real Socket.IO participants for visual QA; no application-side demo mode.
import { Client } from './clients.js';
const url = process.env.TEST_URL ?? 'http://localhost:3001';
const code = process.env.ROOM_CODE;
if (!code) throw new Error('Set ROOM_CODE');
const names = [
  'Ana Clara',
  'Bruno Henrique',
  'Camila Souza',
  'Davi Lucas',
  'Elisa Santos',
  'Felipe Lima',
  'Gabriela Alves',
  'Heitor Costa',
  'Isabela Rocha',
  'João Miguel',
  'Karina Melo',
  'Lucas Gabriel',
  'Mariana Silva',
  'Nicolas Oliveira',
  'Olívia Barros',
  'Pedro Arthur',
  'Rafaela Dias',
  'Samuel Vieira',
  'Talita Gomes',
  'Vinícius Reis',
  'Yasmin Castro',
  'Zeca Ferreira',
  'Bianca Martins',
];
const hints = [
  'Serve para trabalhar e estudar',
  'Faz parte do nosso dia a dia',
  'Ajuda a usar o computador',
  'É comum no laboratório',
  'Facilita as tarefas',
  'Usamos nas aulas de informática',
  'É uma ferramenta muito útil',
  'Ajuda na organização',
  'Fica perto de outros recursos',
  'Pode ser usado na escola',
  'Tem uma função importante',
  'Eu uso quando estou estudando',
];
const clients: Client[] = [];
for (let i = 0; i < names.length; i++) {
  const c = new Client(url);
  clients.push(c);
  await c.connect();
  await c.send({ type: 'room:join', code, name: names[i], avatar: i });
  await c.send({ type: 'player:powers', powers: ['double_vote', 'refuge', 'oracle'] });
  await c.send({ type: 'player:ready', ready: true, avatar: i });
  let round = 0;
  let ready = true;
  c.socket.on('update', () => {
    if (c.room?.phase === 'CLUES' && round !== c.room.round) {
      round = c.room.round;
      setTimeout(
        () => {
          if (c.room?.phase === 'CLUES')
            void c.send({ type: 'clue:submit', text: hints[i % hints.length] }).catch(() => {});
        },
        3500 + i * 1600,
      );
    }
    if (c.room?.phase !== 'LOBBY') ready = false;
    if (c.room?.phase === 'LOBBY' && !ready) {
      ready = true;
      round = 0;
      void c.send({ type: 'player:ready', ready: true, avatar: i });
    }
  });
}
console.log(`Visual QA: ${clients.length} real students connected to ${code}.`);
process.on('SIGINT', () => {
  clients.forEach((c) => c.close());
  process.exit();
});
setInterval(() => {}, 60_000);
