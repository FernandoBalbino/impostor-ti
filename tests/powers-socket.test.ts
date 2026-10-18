import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client, until } from '../scripts/clients.js';
process.env.NODE_ENV = 'test';
const { createGameServer } = await import('../apps/server/src/index.js');

test('24 ativações simultâneas, anonimato, reconexão e repetição do mesmo comando', async () => {
  const service = createGameServer({
    origins: ['http://localhost:5173'],
    revealMs: 5,
    resultMs: 5,
  });
  await new Promise<void>((resolve) => service.httpServer.listen(0, '127.0.0.1', resolve));
  const port = (service.httpServer.address() as { port: number }).port;
  const url = `http://127.0.0.1:${port}`;
  const players = Array.from({ length: 24 }, () => new Client(url));
  const teacher = new Client(url);
  const display = new Client(url);
  const all = [teacher, display, ...players];
  const phase = (name: string) => until(() => all.every((c) => c.room?.phase === name));
  try {
    await Promise.all(all.map((c) => c.connect()));
    await teacher.send({ type: 'room:create' });
    const code = teacher.room!.code;
    for (let i = 0; i < players.length; i++)
      await players[i].send({ type: 'room:join', code, name: `Rede ${i}`, avatar: i });
    await display.send({ type: 'display:join', code });
    await until(() => teacher.room?.players.length === 24);
    await Promise.all(
      players.map((c) => c.send({ type: 'player:powers', powers: ['refuge', 'oracle'] })),
    );
    await Promise.all(
      players.map((c, i) => c.send({ type: 'player:ready', ready: true, avatar: i })),
    );
    await teacher.send({
      type: 'teacher:settings',
      settings: { ...teacher.room!.settings, impostorCount: 3, selectionMode: 'manual' },
      manualImpostorIds: teacher.room!.players.slice(0, 3).map((p) => p.id),
    });
    const old = new Client(url);
    await old.connect();
    const outdated = await old.raw({ type: 'room:create', protocolVersion: 1 });
    old.close();
    assert(!outdated.ok && outdated.code === 'UPDATE_REQUIRED');
    await teacher.send({ type: 'game:start' });
    await phase('CLUES');
    const ids = players.map((c) =>
      c.privateState!.kind === 'player' ? c.privateState!.playerId : '',
    );
    const powerRequests = players.map(() => randomUUID());
    const burst = await Promise.all(
      players.map((c, i) =>
        c.send({ type: 'power:activate', powerId: 'refuge', requestId: powerRequests[i] }),
      ),
    );
    assert.equal(burst.length, 24);
    assert(
      players.every((c) => c.privateState?.kind === 'player' && c.privateState.effects.refuge),
    );
    assert.equal(display.room!.players.length, 24);
    assert(!JSON.stringify(display.packets).includes('notifications'));
    assert(!JSON.stringify(display.packets).includes('powers'));
    assert(!JSON.stringify(display.packets).includes('impostorIds'));
    await players[7].reconnect();
    assert(players[7].privateState?.kind === 'player' && players[7].privateState.effects.refuge);
    const again = await players[7].send({
      type: 'power:activate',
      powerId: 'refuge',
      requestId: powerRequests[7],
    });
    assert.deepEqual(again.ok && again.activation, burst[7].ok && burst[7].activation);
    assert(
      players[7].privateState?.kind === 'player' &&
        players[7].privateState.notifications.length === 1,
    );
    await teacher.send({ type: 'clues:close' });
    await phase('WAITING_FOR_VOTE');
    await teacher.send({ type: 'vote:open' });
    await phase('VOTING');
    await teacher.send({ type: 'vote:close' });
    await phase('WAITING_FOR_NEXT_ROUND');
    await teacher.send({ type: 'round:next' });
    await phase('CLUES');
    await Promise.all(
      players.map((c, i) =>
        c.send({ type: 'power:activate', powerId: 'oracle', targetId: ids[(i + 1) % 24] }),
      ),
    );
    for (let i = 0; i < players.length; i++) {
      const state = players[i].privateState;
      assert(state?.kind === 'player');
      assert.equal(state.effects.refuge, false);
      assert.equal(state.usedPowerRound, 2);
      assert.equal(state.powers.find((p) => p.id === 'oracle')!.readyRound, 6);
      const attacks = state.notifications.filter(
        (n) => n.powerId === 'refuge' && n.title.includes('barreira'),
      );
      assert.equal(attacks.length, 1);
      assert(!JSON.stringify(attacks).includes(`Rede ${(i + 23) % 24}`));
    }
    const health = await fetch(url + '/health').then((r) => r.json());
    assert.equal(health.protocolVersion, 2);
    assert.equal(health.metrics.connections, 26);
    assert(health.metrics.rssBytes > 0);
    assert.equal(health.metrics.commands, all.reduce((sum, c) => sum + c.latencies.length, 0) + 1);
    assert.equal(players[7].disconnects, 1);
    assert(all.filter((c) => c !== players[7]).every((c) => c.disconnects === 0));
  } finally {
    all.forEach((c) => c.close());
    await service.close();
  }
});
