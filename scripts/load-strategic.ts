import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  POWER_IDS,
  POWERS,
  PROTOCOL_VERSION,
  type PowerId,
  type PrivateState,
} from '@impostor/shared';
import { Client, pause, until } from './clients.js';

const url = process.env.TEST_URL ?? 'http://localhost:3001',
  duration = Number(process.env.LOAD_MINUTES ?? 30) * 60000;
const output = process.env.LOAD_REPORT ?? 'qa-evidence/strategic-load.json';
const teacher = new Client(url),
  display = new Client(url),
  students = Array.from({ length: 24 }, () => new Client(url)),
  clients = [teacher, display, ...students];
type State = Extract<PrivateState, { kind: 'player' }>;
const state = (c: Client) => c.privateState as State;
const accepted: Record<string, number> = Object.fromEntries(POWER_IDS.map((id) => [id, 0])),
  declined: Record<string, number> = {};
const samples: unknown[] = [],
  errors: string[] = [],
  planned = new Set<Client>();
let started = 0,
  cleanup = false,
  games = 0,
  rounds = 0,
  bursts = 0,
  retries = 0,
  reconnections = 0,
  abstentions = 0,
  ballots = 0,
  release = '',
  lastProgress = 0;
const report: Record<string, unknown> = {
  url,
  requestedMinutes: duration / 60000,
  students: 24,
  connections: 26,
  profileOffset: Number(process.env.LOAD_PROFILE_OFFSET ?? 10),
  completed: false,
  errors,
};
const phase = async (p: string) => {
  await until(() => clients.every((c) => c.room?.phase === p), 20000);
  // A fase pública e o estado privado chegam em pacotes separados.
  // Aguarde ambos para não reutilizar a confirmação da dica da rodada anterior.
  if (p === 'CLUES')
    await until(() =>
      students
        .filter((c) => c.room!.players.find((player) => player.id === state(c).playerId)!.alive)
        .every((c) => !state(c).clueSubmitted && state(c).clueDeadline === c.room!.clueDeadline),
    );
  await pause(35);
};
const metric = async () => {
  const response = await fetch(url + '/health', { signal: AbortSignal.timeout(10000) });
  assert(response.ok);
  const h = await response.json();
  assert.equal(h.protocolVersion, PROTOCOL_VERSION);
  if (release) assert.equal(h.release, release, 'release changed during test');
  else release = h.release;
  samples.push({ at: new Date().toISOString(), ...h.metrics });
};
const active = () =>
  students.filter((c) => c.room!.players.find((p) => p.id === state(c).playerId)!.alive);
const check = () => {
  for (const c of clients) {
    assert.equal(c.room!.players.length, 24);
    assert.equal(new Set(c.room!.players.map((p) => p.id)).size, 24);
    for (const p of c.room!.players)
      assert.deepEqual(
        Object.keys(p).sort(),
        ['id', 'name', 'avatar', 'online', 'ready', 'alive', 'spectator', 'clue', 'voted'].sort(),
      );
    assert.equal(c.room!.phase, teacher.room!.phase);
  }
  for (const c of active())
    if (
      state(c).effects.blindRound === c.room!.round &&
      !['WAITING_FOR_NEXT_ROUND', 'GAME_OVER'].includes(c.room!.phase)
    ) {
      assert(c.room!.players.every((p) => p.id === state(c).playerId || p.clue === null));
      assert(c.room!.history.every((h) => h.clues.every((p) => p.playerId === state(c).playerId)));
    }
};
const validClue = (c: Client, i: number) => {
  const effects = state(c).effects,
    letter = effects.forbiddenLetter?.toLowerCase();
  let text = 'Pista neutra de investigação ' + i;
  if (letter)
    text = [...text]
      .filter((char) => char.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase() !== letter)
      .join('');
  if (effects.labyrinthWords.length) text += ' ' + effects.labyrinthWords[0];
  return text;
};
async function fillClues() {
  let pending = active().filter((c) => !state(c).clueSubmitted);
  const silence = Math.max(0, ...pending.map((c) => state(c).effects.silencedUntil - c.serverNow));
  if (silence > 0) await pause(silence + 60);
  pending = active().filter((c) => !state(c).clueSubmitted);
  await Promise.all(pending.map((c, i) => c.send({ type: 'clue:submit', text: validClue(c, i) })));
  await phase('WAITING_FOR_VOTE');
}
async function burst(power: PowerId) {
  const r = teacher.room!.round,
    participants = active();
  if (power === 'erase') {
    await Promise.all(
      participants
        .slice(0, -1)
        .map((c, i) => c.send({ type: 'clue:submit', text: validClue(c, i) })),
    );
    await until(() => teacher.room!.clueCount === participants.length - 1);
  }
  if (power === 'prometheus') {
    const half = Math.floor(participants.length / 2);
    await Promise.all(
      participants.slice(0, half).map((c, i) =>
        c.send({
          type: 'power:activate',
          powerId: 'letter',
          targetId: state(participants[half + i]).playerId,
        }),
      ),
    );
    accepted.letter += half;
    await pause(40);
  }
  const commands = participants.map((c, i) => {
    let target = participants[(i + 1) % participants.length];
    if (power === 'erase') target = participants[(i + 1) % (participants.length - 1)];
    if (['aegis', 'chosen', 'prometheus'].includes(power)) target = c;
    return {
      type: 'power:activate',
      powerId: power,
      requestId: randomUUID(),
      ...(POWERS[power].target === 'self' ? {} : { targetId: state(target).playerId }),
      ...(power === 'echo' ? { text: 'Uma frase misteriosa ' + i } : {}),
    };
  });
  const responses = await Promise.all(participants.map((c, i) => c.raw(commands[i])));
  bursts++;
  await pause(45);
  for (let i = 0; i < participants.length; i++) {
    const response = responses[i],
      c = participants[i];
    if (response.ok) {
      accepted[power]++;
      assert.equal(state(c).usedPowerRound, r);
      const slot = state(c).powers.find((s) => s.id === power)!;
      assert.equal(slot.readyRound, r + (slot.cooldown ?? 4));
    } else {
      declined[response.code] = (declined[response.code] ?? 0) + 1;
      assert(
        [
          'EFFECT_ACTIVE',
          'INVALID_TARGET',
          'ONE_POWER_PER_ROUND',
          'POWER_SPENT',
          'POWER_SUSPENDED',
          'NO_PENALTY',
          'POWER_COOLDOWN',
          'VOTE_BANNED',
        ].includes(response.code),
        JSON.stringify(response),
      );
    }
  }
  const i = responses.findIndex((a) => a.ok);
  if (i >= 0) {
    const before = structuredClone(state(participants[i]).powers);
    const again = await participants[i].raw(commands[i]);
    assert.deepEqual(again, responses[i]);
    retries++;
    assert.deepEqual(state(participants[i]).powers, before);
    const other = state(participants[i]).powers.find((p) => p.id !== power)!;
    const denied = await participants[i].raw({
      type: 'power:activate',
      powerId: other.id,
      targetId: state(participants[(i + 2) % participants.length]).playerId,
    });
    assert(!denied.ok);
    assert.equal(denied.code, 'ONE_POWER_PER_ROUND');
  }
  check();
  return { commands, responses, participants };
}
async function voting(target?: string) {
  await teacher.send({ type: 'vote:open' });
  await phase('VOTING');
  const result: Record<string, number> = {};
  let skipped = 0;
  await Promise.all(
    active()
      .filter((c) => state(c).effects.bannedVoteRound !== teacher.room!.round)
      .map(async (c) => {
        let id: string | null = target ?? null;
        if (id === state(c).playerId || teacher.room!.immuneIds.includes(id ?? '')) id = null;
        if (id === null) {
          skipped++;
          abstentions++;
        } else {
          const effects = state(c).effects;
          const weight =
            (effects.dice?.round === teacher.room!.round ? effects.dice.value : 1) *
            (effects.doubleVoteRound === teacher.room!.round ? 2 : 1);
          if (weight > 0) result[id] = (result[id] ?? 0) + weight;
        }
        await c.send({ type: 'vote:submit', targetId: id });
        ballots++;
      }),
  );
  await until(() =>
    active()
      .filter((c) => state(c).effects.bannedVoteRound !== teacher.room!.round)
      .every((c) => c.room!.players.find((p) => p.id === state(c).playerId)!.voted),
  );
  check();
  await teacher.send({ type: 'vote:close' });
  await until(
    () =>
      clients.every((c) =>
        ['WAITING_FOR_NEXT_ROUND', 'TIEBREAK', 'GAME_OVER'].includes(c.room!.phase),
      ),
    25000,
  );
  await pause(35);
  assert.deepEqual(teacher.room!.voteResult!.counts, result);
  assert.equal(teacher.room!.voteResult!.abstentions, skipped);
  if (!Object.keys(result).length) {
    assert.equal(teacher.room!.voteResult!.eliminatedId, null);
    assert.equal(teacher.room!.voteResult!.noVotes, true);
  }
  rounds++;
  check();
}
async function reconnect(c: Client, retry?: Record<string, unknown>, expected?: unknown) {
  const before = structuredClone(state(c));
  planned.add(c);
  await c.reconnect();
  planned.delete(c);
  reconnections++;
  assert.equal(state(c).playerId, before.playerId);
  assert.deepEqual(state(c).powers, before.powers);
  assert.deepEqual(state(c).effects, before.effects);
  assert.deepEqual(state(c).ballot, before.ballot);
  if (retry) {
    const ack = await c.raw(retry);
    assert.deepEqual(ack, expected);
    retries++;
  }
}
const save = async () => {
  const latency = clients.flatMap((c) => c.latencies).sort((a, b) => a - b),
    q = (f: number) => latency[Math.min(latency.length - 1, Math.floor(latency.length * f))] ?? 0;
  Object.assign(report, {
    release,
    protocolVersion: PROTOCOL_VERSION,
    games,
    rounds,
    bursts,
    reconnections,
    retries,
    ballots,
    abstentions,
    accepted,
    declined,
    elapsedSeconds: (performance.now() - started) / 1000,
    commands: latency.length,
    latencyMs: { median: q(0.5), p95: q(0.95), max: latency.at(-1) ?? 0 },
    healthSamples: samples,
    finishedAt: new Date().toISOString(),
  });
  await mkdir('qa-evidence', { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2));
};
let timer: ReturnType<typeof setInterval> | undefined;
try {
  for (const c of clients)
    c.socket.on('disconnect', (reason) => {
      if (!cleanup && !planned.has(c)) {
        errors.push('Unexpected disconnect: ' + reason);
      }
    });
  await Promise.all(clients.map((c) => c.connect()));
  await teacher.send({ type: 'room:create' });
  const code = teacher.session!.code;
  report.code = code;
  await display.send({ type: 'display:join', code });
  await Promise.all(
    students.map((c, i) =>
      c.send({
        type: 'room:join',
        code,
        name: 'Investigador ' + String(i + 1).padStart(2, '0'),
        avatar: i,
      }),
    ),
  );
  started = performance.now();
  report.startedAt = new Date().toISOString();
  await metric();
  timer = setInterval(() => void metric().catch((e) => errors.push(String(e))), 30000);
  while (
    performance.now() - started < duration ||
    games < Number(process.env.LOAD_MIN_GAMES ?? 0)
  ) {
    const primary =
      POWER_IDS[(games + Number(process.env.LOAD_PROFILE_OFFSET ?? 10)) % POWER_IDS.length];
    const profile = [
      primary,
      ...POWER_IDS.filter(
        (id) => id !== primary && ['refuge', 'letter', 'prometheus'].includes(id),
      ),
    ].slice(0, 3);
    if (primary === 'prometheus') {
      profile[1] = 'letter';
      profile[2] = 'refuge';
    }
    await Promise.all(students.map((c) => c.send({ type: 'player:powers', powers: profile })));
    await Promise.all(
      students.map((c, i) => c.send({ type: 'player:ready', avatar: i, ready: true })),
    );
    const count = (1 + (games % 3)) as 1 | 2 | 3;
    await teacher.send({
      type: 'teacher:settings',
      settings: {
        ...teacher.room!.settings,
        clueSeconds: 300,
        selectionMode: 'manual',
        impostorCount: count,
      },
      manualImpostorIds: students.slice(0, count).map((c) => state(c).playerId),
    });
    await teacher.send({ type: 'game:start' });
    await phase('CLUES');
    const first = await burst(primary);
    const successful = first.responses.findIndex((r) => r.ok);
    if (successful >= 0)
      await reconnect(
        first.participants[successful],
        first.commands[successful],
        first.responses[successful],
      );
    await fillClues();
    await voting();
    for (let r = 2; r <= 5; r++) {
      if (teacher.room!.phase === 'GAME_OVER') break;
      await teacher.send({ type: 'round:next' });
      await phase('CLUES');
      if (r === 2) {
        check();
        if (primary === 'name_swap' || primary === 'void_eye' || primary === 'confusion')
          await reconnect(students[1]);
        if (primary === 'pandora') {
          assert(
            students.every(
              (c) => state(c).powers[0].id !== 'pandora' && state(c).powers[0].cooldown === 2,
            ),
          );
          const c = students[0],
            id = state(c).powers[0].id;
          const attempt = await c.raw({
            type: 'power:activate',
            powerId: id,
            ...(POWERS[id].target === 'self' ? {} : { targetId: state(students[1]).playerId }),
            ...(id === 'echo' ? { text: 'Pista de outro universo' } : {}),
          });
          if (attempt.ok) {
            accepted[id]++;
            assert.equal(state(c).powers[0].readyRound, 4);
          }
        } else {
          const c = students[0],
            id = state(c).powers[0].id;
          if (state(c).powers[0].readyRound > r) {
            const before = structuredClone(state(c).powers);
            const response = await c.raw({
              type: 'power:activate',
              powerId: id,
              targetId: state(students[1]).playerId,
            });
            assert(!response.ok);
            assert(['POWER_COOLDOWN', 'POWER_SPENT', 'POWER_SUSPENDED'].includes(response.code));
            assert.deepEqual(state(c).powers, before);
          }
        }
      }
      if (r === 5 && primary !== 'pandora') await burst(primary);
      await fillClues();
      await voting();
    }
    // Finish by eliminating every impostor; shields may require an extra round.
    for (let extra = 0; teacher.room!.phase !== 'GAME_OVER' && extra < 8; extra++) {
      await teacher.send({ type: 'round:next' });
      await phase('CLUES');
      await fillClues();
      const secret = teacher.privateState as Extract<PrivateState, { kind: 'teacher' }>;
      const target = secret.impostorIds.find(
        (id) => teacher.room!.players.find((p) => p.id === id)!.alive,
      )!;
      await voting(target);
    }
    assert.equal(teacher.room!.result!.winner, 'civis');
    games++;
    await teacher.send({ type: 'game:reset' });
    await phase('LOBBY');
    if (process.env.LOAD_FAST === '1') {
      planned.add(teacher);
      await teacher.reconnect();
      planned.delete(teacher);
      reconnections++;
      await Promise.all(students.map((c) => reconnect(c)));
    }
    assert.equal(errors.length, 0, errors.join('\n'));
    if (performance.now() - lastProgress > 30000) {
      lastProgress = performance.now();
      console.log(
        JSON.stringify({
          minutes: ((performance.now() - started) / 60000).toFixed(1),
          games,
          rounds,
          power: primary,
          errors: errors.length,
        }),
      );
      await save();
    }
  }
  if (duration >= 1800000)
    assert(
      POWER_IDS.every((id) => accepted[id] > 0),
      'Every power must be exercised',
    );
  await metric();
  await save();
  const latency = report.latencyMs as { p95: number; max: number };
  assert(latency.p95 <= 1500, 'p95 exceeded 1.5s');
  assert(latency.max <= 5000, 'maximum exceeded 5s');
  assert.equal(errors.length, 0);
  report.completed = true;
  await save();
  console.log(
    JSON.stringify({
      completed: true,
      minutes: report.elapsedSeconds,
      latency: report.latencyMs,
      games,
      rounds,
    }),
  );
} catch (error) {
  report.failureState = clients.map((c) => ({
    kind: c.privateState?.kind,
    phase: c.room?.phase,
    round: c.room?.round,
    clueCount: c.room?.clueCount,
    playerId: c.privateState?.kind === 'player' ? c.privateState.playerId : undefined,
    clueSubmitted: c.privateState?.kind === 'player' ? c.privateState.clueSubmitted : undefined,
    clueDeadline: c.privateState?.kind === 'player' ? c.privateState.clueDeadline : undefined,
  }));
  errors.push(error instanceof Error ? (error.stack ?? error.message) : String(error));
  console.error(errors.at(-1));
} finally {
  if (timer) clearInterval(timer);
  if (started) await save();
  cleanup = true;
  clients.forEach((c) => c.close());
  if (errors.length) process.exitCode = 1;
}
