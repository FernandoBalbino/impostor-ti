import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client, until } from '../scripts/clients.js';
import { randomUUID } from 'node:crypto';
process.env.NODE_ENV = 'test';
const { createGameServer } = await import('../apps/server/src/index.js');
test('24 clientes, professor e telão: fases, isolamento, votos e reconexão reais', async () => {
  const service = createGameServer({
    revealMs: 5,
    resultMs: 5,
    origins: ['https://fernandobalbino.github.io'],
  });
  await new Promise<void>((resolve) => service.httpServer.listen(0, '127.0.0.1', resolve));
  const address = service.httpServer.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}`;
  const teacher = new Client(url);
  const display = new Client(url);
  const players = Array.from({ length: 24 }, () => new Client(url));
  const all = [teacher, display, ...players];
  try {
    await Promise.all(all.map((c) => c.connect()));
    await teacher.send({ type: 'room:create' });
    const code = teacher.room!.code;
    for (let i = 0; i < 24; i++)
      await players[i].send({ type: 'room:join', code, name: `Estudante ${i + 1}`, avatar: i });
    await display.send({ type: 'display:join', code });
    await until(() => all.every((c) => c.room?.players.length === 24));
    assert.deepEqual(display.privateState, { kind: 'display' });
    assert.equal(new Set(teacher.room!.players.map((p) => p.id)).size, 24);
    const rejected = await display.raw({ type: 'game:start' });
    assert.equal(rejected.ok, false);
    const malformed = await players[0].raw({ type: 'player:ready', ready: true, avatar: 99 });
    assert.equal(malformed.ok, false);
    await Promise.all(
      players.map((c) => c.send({ type: 'player:powers', powers: ['double_vote', 'refuge', 'oracle'] })),
    );
    await Promise.all(
      players.map((c, i) => c.send({ type: 'player:ready', ready: true, avatar: i })),
    );
    const impostorId =
      players[0].privateState!.kind === 'player' ? players[0].privateState!.playerId : '';
    await teacher.send({
      type: 'teacher:settings',
      settings: { ...teacher.room!.settings, selectionMode: 'manual' },
      manualImpostorIds: [impostorId],
    });
    await teacher.send({ type: 'game:start' });
    await until(() => all.every((c) => c.room?.phase === 'CLUES'));
    const teacherPrivate = teacher.privateState!;
    assert.equal(teacherPrivate.kind, 'teacher');
    if (teacherPrivate.kind !== 'teacher') throw new Error();
    const word = teacherPrivate.word!;
    assert.equal((players[0].privateState as any).word, null);
    assert.ok(!JSON.stringify(players[0].packets).includes(word.imagem));
    assert.ok(!JSON.stringify(display.packets).includes(word.imagem));
    assert.equal((await players[1].raw({ type: 'vote:open' })).ok, false);
    await Promise.all(
      players.map((c, i) =>
        c.send({ type: 'clue:submit', text: `Minha pista de número ${i + 1}` }),
      ),
    );
    await until(() => all.every((c) => c.room?.phase === 'WAITING_FOR_VOTE'));
    const id = players[7].privateState!.kind === 'player' ? players[7].privateState!.playerId : '';
    await players[7].reconnect();
    assert.equal((players[7].privateState as any).playerId, id);
    assert.equal(teacher.room!.players.length, 24);
    assert.equal((await players[7].raw({ type: 'clue:submit', text: 'Repetida' })).ok, false);
    await teacher.send({ type: 'vote:open' });
    await until(() => all.every((c) => c.room?.phase === 'VOTING'));
    const self = await players[0].raw({ type: 'vote:submit', targetId: impostorId });
    assert.equal(self.ok, false);
    const requestId = randomUUID();
    await players[1].send({ type: 'vote:submit', targetId: impostorId, requestId });
    await players[1].send({ type: 'vote:submit', targetId: impostorId, requestId });
    await Promise.all(
      players.slice(2).map((c) => c.send({ type: 'vote:submit', targetId: impostorId })),
    );
    await until(() => teacher.room!.players.filter((p) => p.voted).length === 23);
    assert.equal(display.room!.voteResult, null);
    await teacher.send({ type: 'vote:close' });
    await until(() => all.every((c) => c.room?.phase === 'GAME_OVER'));
    assert.equal(teacher.room!.result!.winner, 'civis');
    assert.equal(teacher.room!.voteResult!.counts[impostorId], 23);
    await teacher.send({ type: 'game:reset' });
    await until(() => all.every((c) => c.room?.phase === 'LOBBY'));
    assert.equal(teacher.room!.players.length, 24);
    assert.equal((players[0].privateState as any).role, null);
    const evil = new Client(url, 'https://not-authorized.example');
    await assert.rejects(() => evil.connect());
    evil.close();
  } finally {
    all.forEach((c) => c.close());
    await service.close();
  }
});
