import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { POWER_IDS, type PowerId, type PrivateState, type Ack } from '@impostor/shared';
import { Client, pause, until } from './clients.js';

const url = process.env.TEST_URL ?? 'http://localhost:3001';
const minutes = Number(process.env.LOAD_MINUTES ?? 30);
const duration = minutes * 60_000;
const output = process.env.LOAD_REPORT ?? 'qa-evidence/powers/load-report.json';
const profileOffset = Number(process.env.LOAD_PROFILE_OFFSET ?? 0);
const profiles: [PowerId, PowerId][] = [
  ['refuge', 'oracle'],
  ['oracle', 'veil'],
  ['silence', 'letter'],
  ['echo', 'erase'],
  ['aegis', 'ban_vote'],
  ['double_vote', 'ban_vote'],
];
type PlayerState = Extract<PrivateState, { kind: 'player' }>;
const state = (c: Client) => {
  assert.equal(c.privateState?.kind, 'player');
  return c.privateState as PlayerState;
};
const students = Array.from({ length: 24 }, () => new Client(url));
const teacher = new Client(url);
const display = new Client(url);
const clients = [teacher, display, ...students];
const plannedDisconnects = new Set<Client>();
let cleanup = false;
let interval: ReturnType<typeof setInterval> | undefined;
const healthSamples: unknown[] = [];
const failures: string[] = [];
const accepted: Record<string, number> = Object.fromEntries(POWER_IDS.map((id) => [id, 0]));
const declined: Record<string, number> = {};
let games = 0,
  rounds = 0,
  bursts = 0,
  reconnections = 0,
  retries = 0,
  lastReconnect = 0,
  lastProgress = 0,
  started = 0;
const report: Record<string, unknown> = {
  url,
  requestedMinutes: minutes,
  students: 24,
  connections: 26,
  profileOffset,
  completed: false,
  errors: failures,
};
const phase = async (p: string) => {
  await until(() => clients.every((c) => c.room?.phase === p), 20000);
  if (p === 'CLUES')
    await until(() =>
      students.every((c) => {
        const own = state(c);
        return !own.clueSubmitted && own.clueDeadline === teacher.room!.clueDeadline;
      }),
    );
};
const metrics = async () => {
  const response = await fetch(url + '/health', { signal: AbortSignal.timeout(10000) });
  assert(response.ok);
  const h = await response.json();
  assert.equal(h.protocolVersion, 2);
  healthSamples.push({ at: new Date().toISOString(), ...h.metrics });
};
const checkpoint = () => {
  for (const c of clients) {
    assert.equal(c.room!.players.length, 24);
    assert.equal(c.room!.phase, teacher.room!.phase);
    assert.equal(new Set(c.room!.players.map((p) => p.id)).size, 24);
  }
  assert.equal(display.privateState?.kind, 'display');
};
const validClue = (c: Client, i: number) => {
  const letter = state(c).effects.forbiddenLetter?.toLowerCase();
  return Array.from(`Pista de informática número ${i + 1}`)
    .filter(
      (char) => !letter || char.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase() !== letter,
    )
    .join('');
};
async function activateBurst(power: PowerId) {
  const r = teacher.room!.round;
  if (power === 'erase') {
    await Promise.all(
      students.slice(0, 23).map((c, i) => c.send({ type: 'clue:submit', text: validClue(c, i) })),
    );
    await until(() => teacher.room?.clueCount === 23);
  }
  const requests = students.map(() => randomUUID());
  const commands = students.map((c, i) => ({
    type: 'power:activate',
    powerId: power,
    requestId: requests[i],
    ...(power === 'refuge' || power === 'double_vote'
      ? {}
      : {
          targetId: state(
            students[power === 'aegis' ? i : power === 'erase' ? (i + 1) % 23 : (i + 1) % 24],
          ).playerId,
        }),
    ...(power === 'echo' ? { text: `Pista imaginária ${i + 1}` } : {}),
  }));
  const responses: Ack[] = await Promise.all(students.map((c, i) => c.raw(commands[i])));
  bursts++;
  for (let i = 0; i < 24; i++) {
    const ack = responses[i];
    if (ack.ok) {
      accepted[power]++;
      assert.equal(state(students[i]).usedPowerRound, r);
      const slot = state(students[i]).powers.find((s) => s.id === power)!;
      assert.equal(slot.readyRound, r + 4);
      assert(slot.used);
      assert(ack.activation);
    } else {
      assert(
        ['POWER_SPENT', 'EFFECT_ACTIVE', 'INVALID_TARGET'].includes(ack.code),
        JSON.stringify(ack),
      );
      declined[ack.code] = (declined[ack.code] ?? 0) + 1;
      assert.notEqual(state(students[i]).usedPowerRound, r);
    }
  }
  const index = responses.findIndex((ack) => ack.ok);
  if (index >= 0) {
    const before = structuredClone(state(students[index]));
    const repeat = await students[index].raw(commands[index]);
    retries++;
    assert.deepEqual(repeat, responses[index]);
    assert.deepEqual(state(students[index]).powers, before.powers);
    const another = before.powers.find((s) => s.id !== power)!.id;
    const blocked = await students[index].raw({
      type: 'power:activate',
      powerId: another,
      targetId: state(students[(index + 1) % 24]).playerId,
    });
    assert(!blocked.ok && blocked.code === 'ONE_POWER_PER_ROUND');
    if (Date.now() - lastReconnect > 60000) {
      const c = students[index];
      plannedDisconnects.add(c);
      await c.reconnect();
      plannedDisconnects.delete(c);
      reconnections++;
      lastReconnect = Date.now();
      assert.deepEqual(state(c).powers, before.powers);
      assert.equal(state(c).usedPowerRound, r);
      const again = await c.raw(commands[index]);
      retries++;
      assert.deepEqual(again, responses[index]);
    }
  }
  for (const c of students) {
    const privateState = state(c);
    for (const notice of privateState.notifications) {
      assert(!('actorId' in notice));
      assert(!('sourceId' in notice));
      if (notice.title.startsWith('Você foi alvo')) assert(!notice.message.includes('Carga '));
    }
  }
  const pub = JSON.stringify(display.room);
  for (const secret of [
    'notifications',
    'powers',
    'usedPowerRound',
    'forbiddenLetter',
    'impostorIds',
  ])
    assert(!pub.includes('"' + secret + '"'));
  if (power === 'erase') {
    const normalDeadline = teacher.room!.clueDeadline;
    await teacher.send({ type: 'clues:close' });
    // The public delta is batched; wait for it and the preceding private deadlines.
    await until(() => clients.every((c) => c.room!.clueDeadline !== normalDeadline));
  }
}
async function collectClues() {
  const silenceRemaining = Math.max(
    ...students.map((c) => state(c).effects.silencedUntil - c.serverNow),
  );
  if (silenceRemaining > 0) await pause(silenceRemaining + 60);
  await Promise.all(
    students.map(async (c, i) => {
      const p = state(c);
      const participant = c.room!.players.find((player) => player.id === p.playerId);
      if (!participant?.alive || participant.spectator) return;
      if (p.clueSubmitted || !p.clueDeadline || p.clueDeadline <= c.serverNow) return;
      if (
        teacher.room!.deadline !== teacher.room!.clueDeadline &&
        p.clueDeadline === teacher.room!.clueDeadline
      )
        return;
      await c.send({ type: 'clue:submit', text: validClue(c, i) });
    }),
  );
  if (teacher.room!.phase === 'CLUES') {
    const closed = await teacher.raw({ type: 'clues:close' });
    // The final clue can advance the server before its broadcast reaches the teacher.
    assert(closed.ok || closed.code === 'WRONG_PHASE', JSON.stringify(closed));
  }
  await phase('WAITING_FOR_VOTE');
}
async function castVotes(target: string | null) {
  await teacher.send({ type: 'vote:open' });
  await phase('VOTING');
  const alive = teacher.room!.players.filter((p) => p.alive && !p.spectator);
  const expected: Record<string, number> = {};
  const votes = students.map((c, i) => {
    const p = state(c);
    if (
      !alive.some((x) => x.id === p.playerId) ||
      p.effects.bannedVoteRound === teacher.room!.round
    )
      return null;
    const to = target
      ? p.playerId === target
        ? alive.find((x) => x.id !== target)!.id
        : target
      : alive[i % 2 ? alive.length - 2 : alive.length - 1].id;
    assert.notEqual(to, p.playerId);
    expected[to] =
      (expected[to] ?? 0) + (p.effects.doubleVoteRound === teacher.room!.round ? 2 : 1);
    return c.send({ type: 'vote:submit', targetId: to });
  });
  await Promise.all(votes);
  await teacher.send({ type: 'vote:close' });
  await until(
    () =>
      clients.every((c) =>
        ['TIEBREAK', 'WAITING_FOR_NEXT_ROUND', 'GAME_OVER'].includes(c.room?.phase ?? ''),
      ),
    20000,
  );
  assert.deepEqual(teacher.room!.voteResult!.counts, expected);
  if (teacher.room!.phase === 'TIEBREAK') {
    await teacher.send({ type: 'vote:open' });
    await phase('VOTING');
    await teacher.send({ type: 'vote:close' });
    await phase('WAITING_FOR_NEXT_ROUND');
  }
  checkpoint();
}
try {
  for (const c of clients)
    c.socket.on('disconnect', (reason) => {
      if (!cleanup && !plannedDisconnects.has(c)) failures.push('Unexpected disconnect: ' + reason);
    });
  await Promise.all(clients.map((c) => c.connect()));
  await teacher.send({ type: 'room:create' });
  const code = teacher.room!.code;
  for (let i = 0; i < 24; i++)
    await students[i].send({
      type: 'room:join',
      code,
      name: `Carga ${String(i + 1).padStart(2, '0')}`,
      avatar: i,
    });
  await display.send({ type: 'display:join', code });
  await until(() => clients.every((c) => c.room?.players.length === 24));
  started = Date.now();
  lastProgress = started;
  report.startedAt = new Date(started).toISOString();
  await metrics();
  interval = setInterval(() => void metrics().catch((e) => failures.push(String(e))), 60000);
  interval.unref();
  while (Date.now() - started < duration) {
    if (teacher.room!.phase === 'GAME_OVER') {
      await teacher.send({ type: 'game:reset' });
      await phase('LOBBY');
    }
    const profile = profiles[(games + profileOffset) % profiles.length];
    await Promise.all(students.map((c) => c.send({ type: 'player:powers', powers: profile })));
    await Promise.all(
      students.map((c, i) => c.send({ type: 'player:ready', ready: true, avatar: i })),
    );
    const impostors = ((games % 3) + 1) as 1 | 2 | 3;
    const ids = teacher.room!.players.slice(0, impostors).map((p) => p.id);
    await teacher.send({
      type: 'teacher:settings',
      settings: {
        ...teacher.room!.settings,
        clueSeconds: 60,
        impostorCount: impostors,
        selectionMode: 'manual',
      },
      manualImpostorIds: ids,
    });
    await teacher.send({ type: 'game:start' });
    await phase('CLUES');
    for (let round = 1; round <= 12; round++) {
      rounds++;
      const allAlive = teacher.room!.players.filter((p) => p.alive).length === 24;
      const power =
        round === 1 || round === 5 ? profile[0] : round === 2 || round === 6 ? profile[1] : null;
      if (power && allAlive) await activateBurst(power);
      await collectClues();
      const target =
        round >= 5
          ? (teacher.room!.players.find((p) => p.alive && ids.includes(p.id))?.id ?? null)
          : null;
      await castVotes(target);
      if (teacher.room!.phase === 'GAME_OVER') break;
      await teacher.send({ type: 'round:next' });
      await phase('CLUES');
    }
    assert.equal(teacher.room!.phase, 'GAME_OVER', 'A partida deve concluir em até 12 rodadas');
    assert.equal(teacher.room!.result!.winner, 'civis');
    games++;
    if (failures.length) throw new Error(failures.join('; '));
    if (Date.now() - lastProgress >= 45000) {
      console.log(
        JSON.stringify({
          minutes: ((Date.now() - started) / 60000).toFixed(1),
          games,
          rounds,
          bursts,
          reconnections,
          accepted,
        }),
      );
      lastProgress = Date.now();
    }
  }
  await metrics();
  const latencies = clients.flatMap((c) => c.latencies).sort((a, b) => a - b);
  const percentile = (p: number) =>
    latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))];
  const p95 = percentile(0.95),
    max = latencies.at(-1)!;
  assert(p95 <= 1500, `p95 ${p95}ms excedeu 1500ms`);
  assert(max <= 5000, `máxima ${max}ms excedeu 5000ms`);
  if (minutes >= 30)
    assert(
      POWER_IDS.every((id) => accepted[id] > 0),
      'Todos os dez poderes precisam ser exercitados',
    );
  assert.deepEqual(failures, []);
  Object.assign(report, {
    completed: true,
    finishedAt: new Date().toISOString(),
    durationSeconds: (Date.now() - started) / 1000,
    games,
    rounds,
    bursts,
    reconnections,
    repeatedRequests: retries,
    acceptedPowers: accepted,
    expectedDeclines: declined,
    commands: latencies.length,
    latencyMs: { p50: percentile(0.5), p95, max },
    healthSamples,
  });
} catch (e) {
  failures.push(e instanceof Error ? (e.stack ?? e.message) : String(e));
  Object.assign(report, {
    games,
    rounds,
    bursts,
    reconnections,
    acceptedPowers: accepted,
    healthSamples,
  });
  process.exitCode = 1;
} finally {
  cleanup = true;
  if (interval) clearInterval(interval);
  clients.forEach((c) => c.close());
  await mkdir(new URL('../qa-evidence/powers/', import.meta.url), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
