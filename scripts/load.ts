import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { Client, pause, until } from './clients.js';
const url = process.env.TEST_URL ?? 'http://localhost:3001';
const minutes = Number(process.env.LOAD_MINUTES ?? '30');
const duration = minutes * 60_000;
const started = Date.now();
const students = Array.from({ length: 24 }, () => new Client(url));
const teacher = new Client(url);
const display = new Client(url);
const clients = [teacher, display, ...students];
let games = 0,
  rounds = 0,
  reconnections = 0;
let code = '';
let lastReconnect = 0;
let lastProgress = started;
const expectedDisconnects = new Map<Client, number>();
const report: Record<string, unknown> = {
  url,
  requestedMinutes: minutes,
  startedAt: new Date(started).toISOString(),
  clients: 26,
  students: 24,
  errors: [],
  completed: false,
};
const phase = async (p: string) => until(() => clients.every((c) => c.room?.phase === p), 15000);
const sync = () => {
  const state = teacher.room!;
  for (const c of clients) {
    assert.equal(c.room!.players.length, 24);
    assert.equal(new Set(c.room!.players.map((p) => p.id)).size, 24);
    assert.equal(c.room!.phase, state.phase);
  }
};
try {
  await Promise.all(clients.map((c) => c.connect()));
  await teacher.send({ type: 'room:create' });
  code = teacher.room!.code;
  for (let i = 0; i < 24; i++)
    await students[i].send({
      type: 'room:join',
      code,
      name: `Carga ${String(i + 1).padStart(2, '0')}`,
      avatar: i,
    });
  await display.send({ type: 'display:join', code });
  await until(() => clients.every((c) => c.room?.players.length === 24));
  while (Date.now() - started < duration) {
    if (teacher.room!.phase === 'GAME_OVER') {
      await teacher.send({ type: 'game:reset' });
      await phase('LOBBY');
    }
    await Promise.all(
      students.map((c) => c.send({ type: 'player:powers', powers: ['double_vote', 'refuge', 'oracle'] })),
    );
    await Promise.all(
      students.map((c, i) => c.send({ type: 'player:ready', ready: true, avatar: i })),
    );
    const impostorId = teacher.room!.players[0].id;
    await teacher.send({
      type: 'teacher:settings',
      settings: { ...teacher.room!.settings, clueSeconds: 30, selectionMode: 'manual' },
      manualImpostorIds: [impostorId],
    });
    await teacher.send({ type: 'game:start' });
    await phase('CLUES');
    assert.equal((students[0].privateState as any).word, null);
    assert.deepEqual(display.privateState, { kind: 'display' });
    const word = (teacher.privateState as any).word;
    assert.ok(word);
    assert.ok(!JSON.stringify(students[0].privateState).includes(word.imagem));
    for (let round = 0; round < 2; round++) {
      rounds++;
      const alive = teacher.room!.players.filter((p) => p.alive);
      await Promise.all(
        students.map(async (c, i) => {
          const p = c.room!.players.find((p) => p.id === (c.privateState as any).playerId);
          if (!p?.alive) return;
          await pause(i * 70);
          await c.send({ type: 'clue:submit', text: `Pista de informática número ${i + 1}` });
        }),
      );
      await phase('WAITING_FOR_VOTE');
      sync();
      if (Date.now() - lastReconnect > 60_000) {
        await students[7].reconnect();
        reconnections++;
        expectedDisconnects.set(students[7], reconnections);
        lastReconnect = Date.now();
        assert.equal(students[7].room!.players.length, 24);
      }
      await teacher.send({ type: 'vote:open' });
      await phase('VOTING');
      const target = round === 0 ? alive.find((p) => p.id !== impostorId)!.id : impostorId;
      await Promise.all(
        students.map(async (c, i) => {
          const id = (c.privateState as any).playerId;
          const p = teacher.room!.players.find((p) => p.id === id);
          if (!p?.alive) return;
          const alternative = alive.find((p) => p.id !== id && p.id !== target)!.id;
          await pause(i * 50);
          await c.send({ type: 'vote:submit', targetId: id === target ? alternative : target });
        }),
      );
      await until(
        () => teacher.room!.players.filter((p) => p.voted && p.alive).length === alive.length,
      );
      assert.equal(display.room!.voteResult, null);
      await teacher.send({ type: 'vote:close' });
      await phase(round === 0 ? 'WAITING_FOR_NEXT_ROUND' : 'GAME_OVER');
      sync();
      assert.equal(teacher.room!.voteResult!.counts[target], alive.length - 1);
      if (round === 0) {
        assert.equal(teacher.room!.result, null);
        await teacher.send({ type: 'round:next' });
        await phase('CLUES');
      }
    }
    games++;
    assert.equal(teacher.room!.result!.winner, 'civis');
    if (Date.now() - lastProgress > 60_000) {
      console.log(
        JSON.stringify({
          elapsedSeconds: Math.round((Date.now() - started) / 1000),
          games,
          rounds,
          reconnections,
        }),
      );
      lastProgress = Date.now();
    }
  }
  for (const c of clients)
    assert.equal(c.disconnects, expectedDisconnects.get(c) ?? 0, 'Unexpected disconnect');
  report.completed = true;
} catch (error) {
  (report.errors as string[]).push(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  const latencies = clients.flatMap((c) => c.latencies).sort((a, b) => a - b);
  Object.assign(report, {
    finishedAt: new Date().toISOString(),
    durationSeconds: Math.round((Date.now() - started) / 1000),
    games,
    rounds,
    reconnections,
    eventsReceived: clients.reduce((n, c) => n + c.updates, 0),
    commands: latencies.length,
    p50Ms: Math.round(latencies[Math.floor(latencies.length * 0.5)] ?? 0),
    p95Ms: Math.round(latencies[Math.floor(latencies.length * 0.95)] ?? 0),
    maxMs: Math.round(latencies.at(-1) ?? 0),
  });
  clients.forEach((c) => c.close());
  await mkdir('qa-evidence', { recursive: true });
  const output = process.env.LOAD_REPORT ?? 'qa-evidence/load-report.json';
  await writeFile(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
