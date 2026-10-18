import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test';
const { createGameServer } = await import('../apps/server/src/index.js');
import { Client, until } from '../scripts/clients.js';

test('visões Socket.IO isolam dicas, histórico, confusão e snapshot repetido após reconexão', async (t) => {
  const server = createGameServer({ revealMs: 1, resultMs: 1 });
  await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  const address = server.httpServer.address() as { port: number };
  const url = 'http://127.0.0.1:' + address.port;
  const teacher = new Client(url),
    display = new Client(url),
    players = Array.from({ length: 8 }, () => new Client(url));
  t.after(async () => {
    [teacher, display, ...players].forEach((c) => c.close());
    await server.close();
  });
  await Promise.all([teacher, display, ...players].map((c) => c.connect()));
  await teacher.send({ type: 'room:create' });
  const code = teacher.session!.code;
  await display.send({ type: 'display:join', code });
  for (let i = 0; i < 8; i++) {
    await players[i].send({ type: 'room:join', code, name: 'Estudante ' + i, avatar: i });
    await players[i].send({
      type: 'player:powers',
      powers: i === 0 ? ['void_eye', 'confusion', 'refuge'] : ['refuge', 'oracle', 'prometheus'],
    });
    await players[i].send({ type: 'player:ready', ready: true, avatar: i });
  }
  await teacher.send({ type: 'game:start' });
  await until(() => players.every((c) => c.room?.phase === 'CLUES'));
  const own = (i: number) => {
    const s = players[i].privateState;
    if (s?.kind !== 'player') throw Error('state');
    return s;
  };
  const victimId = own(1).playerId;
  const resume = {
    type: 'session:resume',
    code,
    token: players[1].session!.token,
    requestId: 'cached-resume-12345',
  };
  await players[1].send(resume);
  await players[0].send({ type: 'power:activate', powerId: 'void_eye', targetId: victimId });
  await players[2].send({ type: 'clue:submit', text: 'Marcador histórico confidencial' });
  await teacher.send({ type: 'clues:close' });
  await teacher.send({ type: 'vote:open' });
  await teacher.send({ type: 'vote:close' });
  await until(() => teacher.room?.phase === 'WAITING_FOR_NEXT_ROUND');
  await teacher.send({ type: 'round:next' });
  await until(() => players.every((c) => c.room?.phase === 'CLUES' && c.room.round === 2));
  players[1].packets = [];
  await players[2].send({ type: 'clue:submit', text: 'Marcador novo confidencial' });
  await until(
    () => teacher.room?.players.some((p) => p.clue === 'Marcador novo confidencial') === true,
  );
  await until(() => players[1].room?.clueCount === 1);
  assert.equal(players[1].room!.players.find((p) => p.id === own(2).playerId)!.clue, null);
  assert(!JSON.stringify(players[1].packets).includes('Marcador novo confidencial'));
  const replay = await players[1].send(resume);
  assert(!JSON.stringify(replay).includes('Marcador histórico confidencial'));
  assert(!JSON.stringify(replay).includes('Marcador novo confidencial'));
  await players[1].reconnect();
  assert.equal(own(1).effects.blindRound, 2);
  assert(!JSON.stringify(players[1].room).includes('Marcador novo confidencial'));
  await players[0].send({ type: 'power:activate', powerId: 'confusion', targetId: victimId });
  await teacher.send({ type: 'clues:close' });
  await teacher.send({ type: 'vote:open' });
  await until(() => players.every((c) => c.room?.phase === 'VOTING'));
  const original = teacher.room!.players.map((p) => p.name);
  const fake = players[1].room!.players.map((p) => p.name);
  assert(fake.every((name, i) => name !== original[i]));
  assert.deepEqual(
    players[2].room!.players.map((p) => p.name),
    original,
  );
  await players[1].send({ type: 'vote:submit', targetId: null });
  await until(() => own(1).ballot !== null);
  const publicView = teacher.room!;
  assert.equal(publicView.voteResult, null);
  assert(publicView.players.every((p) => !('ballot' in p)));
  await players[1].reconnect();
  assert.equal(own(1).ballot!.targetId, null);
  assert.deepEqual(
    players[1].room!.players.map((p) => p.name),
    fake,
  );
  await teacher.send({ type: 'vote:close' });
  await until(
    () =>
      teacher.room?.phase === 'VOTE_RESULTS' || teacher.room?.phase === 'WAITING_FOR_NEXT_ROUND',
  );
  assert.equal(teacher.room!.voteResult!.abstentions, 1);
});
