import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  POWER_IDS,
  PROTOCOL_VERSION,
  type Command,
  type PowerId,
  type PrivateState,
} from '@impostor/shared';
import { GameEngine, GameError, normalize } from '../apps/server/src/engine.js';
import { until } from '../scripts/clients.js';

async function fixture(
  t: { after: (fn: () => void) => void },
  loadouts: PowerId[][] = [],
  random = (n: number) => 0,
) {
  const e = new GameEngine({ revealMs: 1, resultMs: 1, random });
  t.after(() => e.close());
  const teacher = e.create('teacher').auth,
    r = e.room(teacher.code);
  const p = Array.from({ length: 8 }, (_, i) => e.join(r.code, 'Aluno ' + i, i, 's' + i).auth);
  const send = (auth: typeof teacher, data: Record<string, unknown>) =>
    e.execute(auth, {
      protocolVersion: PROTOCOL_VERSION,
      requestId: randomUUID(),
      ...(data.type === 'vote:submit' ? { ballotId: r.ballotId } : {}),
      ...data,
    } as Command);
  for (let i = 0; i < p.length; i++) {
    const ids = loadouts[i] ?? [];
    send(p[i], {
      type: 'player:powers',
      powers: [...ids, ...POWER_IDS.filter((id) => !ids.includes(id))].slice(0, 3),
    });
    send(p[i], { type: 'player:ready', avatar: i, ready: true });
  }
  send(teacher, {
    type: 'teacher:settings',
    settings: { ...r.settings, selectionMode: 'manual' },
    manualImpostorIds: [p[0].playerId],
  });
  send(teacher, { type: 'game:start' });
  await until(() => r.phase === 'CLUES');
  r.word = {
    id: 'test',
    nome: 'Teclado',
    categoria: 'Hardware',
    imagem: 'assets/items/keyboard.svg',
    dificuldade: 'facil',
  };
  const state = (i: number) => e.privateState(r, p[i]) as Extract<PrivateState, { kind: 'player' }>;
  const cast = (i: number, id: PowerId, target?: number, requestId?: string) =>
    send(p[i], {
      type: 'power:activate',
      powerId: id,
      ...(target !== undefined ? { targetId: p[target].playerId } : {}),
      ...(requestId ? { requestId } : {}),
    });
  const open = () => {
    if (r.phase === 'CLUES') send(teacher, { type: 'clues:close' });
    send(teacher, { type: 'vote:open' });
  };
  const close = async () => {
    send(teacher, { type: 'vote:close' });
    await until(() => ['WAITING_FOR_NEXT_ROUND', 'TIEBREAK', 'GAME_OVER'].includes(r.phase));
  };
  const next = async () => {
    if (r.phase === 'CLUES') open();
    if (r.phase === 'VOTING') await close();
    send(teacher, { type: 'round:next' });
  };
  const clue = (i: number, text = 'Pista verdadeira ' + i) =>
    send(p[i], { type: 'clue:submit', text });
  const vote = (i: number, target: number | null, extra = {}) =>
    send(p[i], {
      type: 'vote:submit',
      targetId: target === null ? null : p[target].playerId,
      ...extra,
    });
  return { e, r, p, teacher, state, cast, send, open, close, next, clue, vote };
}
const rejects = (fn: () => unknown, code: string) =>
  assert.throws(fn, (e: unknown) => e instanceof GameError && e.code === code);

test('labirinto respeita letra proibida e aceita acentos somente no envio verdadeiro', async (t) => {
  const s = await fixture(t, [['letter'], ['labyrinth']]);
  s.cast(0, 'letter', 2);
  s.cast(1, 'labyrinth', 2);
  const effect = s.state(2).effects;
  assert.equal(effect.labyrinthWords.length, 3);
  assert(
    effect.labyrinthWords.every(
      (w) => !normalize(w).includes(effect.forbiddenLetter!.toLowerCase()),
    ),
  );
  rejects(() => s.clue(2, 'zzzz'), 'LABYRINTH_WORD');
  const word = effect.labyrinthWords[0];
  s.clue(2, word.toUpperCase().replace('O', 'Ó'));
  assert.deepEqual(s.state(2).effects.labyrinthWords, []);
  assert.equal(s.state(2).effects.forbiddenLetter, null);
});

for (let value = 0; value < 4; value++)
  test(
    'dado ' + value + ' com peso da verdade, abstenção e cura sem alterar voto confirmado',
    async (t) => {
      const s = await fixture(t, [['dice'], ['double_vote'], ['prometheus']], (n) =>
        Math.min(value, n - 1),
      );
      s.cast(0, 'dice', 1);
      s.cast(1, 'double_vote');
      assert.equal(s.state(1).effects.dice!.value, value);
      s.open();
      s.vote(1, 3);
      s.vote(4, null);
      s.cast(2, 'prometheus', 1);
      assert.equal(s.state(1).effects.dice, null);
      await s.close();
      assert.equal(s.r.voteResult!.counts[s.p[3].playerId!] ?? 0, value * 2);
      assert.equal(s.r.voteResult!.abstentions, 1);
      assert.equal(s.r.voteResult!.noVotes, value === 0);
      if (value === 0) assert.deepEqual(s.r.voteResult!.tied, []);
    },
  );

test('pandora transforma sem duplicatas, herda suspensão, recarrega em duas rodadas e restaura seleção no lobby', async (t) => {
  const s = await fixture(t, [['pandora', 'oracle', 'refuge'], ['divine_hand']]);
  s.cast(0, 'pandora');
  s.cast(1, 'divine_hand', 0);
  await s.next();
  const slot = s.state(0).powers[0];
  assert.equal(slot.id, 'silence');
  assert.equal(slot.cooldown, 2);
  assert.equal(slot.blockedUntilRound, 2);
  rejects(() => s.cast(0, 'silence', 2), 'POWER_SUSPENDED');
  await s.next();
  s.cast(0, 'silence', 2);
  assert.equal(s.state(0).powers[0].readyRound, 5);
  await s.next();
  rejects(() => s.cast(0, 'silence', 2), 'POWER_COOLDOWN');
  await s.next();
  s.cast(0, 'silence', 3);
  s.send(s.teacher, { type: 'game:end' });
  s.send(s.teacher, { type: 'game:reset' });
  assert.deepEqual(
    s.state(0).powers.map((x) => x.id),
    ['pandora', 'oracle', 'refuge'],
  );
  assert(
    s
      .state(0)
      .powers.every((x) => !x.used && !x.blockedUntilRound && !x.cooldown && !x.pendingRound),
  );
});

test('close é global na próxima rodada, confusão é privada e cura restaura os dois nomes', async (t) => {
  const s = await fixture(t, [['name_swap'], ['prometheus'], ['confusion']]);
  const names = s.r.players.map((p) => p.name);
  s.cast(0, 'name_swap', 1);
  assert.deepEqual(
    s.e.public(s.r).players.map((p) => p.name),
    names,
  );
  await s.next();
  const swapped = [...names];
  [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  assert.deepEqual(
    s.e.public(s.r).players.map((p) => p.name),
    swapped,
  );
  assert.deepEqual(
    (s.e.privateState(s.r, s.teacher) as Extract<PrivateState, { kind: 'teacher' }>).identities.map(
      (p) => p.name,
    ),
    names,
  );
  s.cast(2, 'confusion', 3);
  s.open();
  const confused = s.e.public(s.r, s.p[3]);
  assert(confused.players.every((p, i) => p.name !== swapped[i]));
  assert.deepEqual(
    confused.players.map((p) => p.avatar),
    s.r.players.map((p) => p.avatar),
  );
  assert.deepEqual(
    s.e.public(s.r, s.p[4]).players.map((p) => p.name),
    swapped,
  );
  s.cast(1, 'prometheus', 0);
  assert.deepEqual(
    s.e.public(s.r).players.map((p) => p.name),
    names,
  );
  const before = s.e.public(s.r, s.p[3]);
  s.e.resume(s.r.code, s.p[3].token!, 'reconnected');
  assert.deepEqual(s.e.public(s.r, s.p[3]).players, before.players);
  await s.close();
  assert.deepEqual(
    s.e.public(s.r, s.p[3]).players.map((p) => p.name),
    names,
  );
});

test('tudo ou nada preserva dicas verdadeiras, respeita refúgio individual e cura só um participante', async (t) => {
  const s = await fixture(t, [['all_or_nothing'], ['refuge'], [], ['prometheus']]);
  s.cast(1, 'refuge');
  s.cast(0, 'all_or_nothing');
  assert.equal(s.state(1).effects.refuge, false);
  assert.equal(s.state(1).effects.chaos, null);
  assert(s.state(2).effects.chaos);
  s.clue(0);
  s.clue(1);
  s.clue(2);
  assert.equal(s.r.players[0].clue, 'Pista verdadeira 0');
  assert.equal(s.e.public(s.r).players[0].clue, 'Pista verdadeira 0');
  s.open();
  assert.notEqual(s.e.public(s.r).players[0].clue, 'Pista verdadeira 0');
  assert.equal(s.e.public(s.r).players[1].clue, 'Pista verdadeira 1');
  assert.notEqual(s.e.public(s.r).history[0].clues[0].text, 'Pista verdadeira 0');
  s.cast(3, 'prometheus', 0);
  assert.equal(s.e.public(s.r).players[0].clue, 'Pista verdadeira 0');
  assert.notEqual(s.e.public(s.r).players[2].clue, 'Pista verdadeira 2');
  await s.close();
  assert.equal(s.e.public(s.r).players[2].clue, 'Pista verdadeira 2');
});

test('tudo ou nada reserva alvos e rejeita conflito sem cobrar', async (t) => {
  const s = await fixture(t, [['all_or_nothing'], ['all_or_nothing'], ['all_or_nothing']]);
  s.cast(0, 'all_or_nothing');
  rejects(() => s.cast(1, 'all_or_nothing'), 'EFFECT_ACTIVE');
  assert.equal(s.state(1).usedPowerRound, 0);
  assert.equal(s.state(1).powers[0].readyRound, 0);
});

test('olho do vazio oculta dados de dicas e histórico na próxima rodada e fogo desfaz o bloqueio', async (t) => {
  const s = await fixture(t, [['void_eye'], [], ['prometheus']]);
  s.clue(0, 'Histórico reservado');
  s.clue(1, 'Minha dica antiga');
  s.cast(0, 'void_eye', 1);
  await s.next();
  s.clue(0, 'Segredo da rodada seguinte');
  s.clue(1, 'Minha dica nova');
  const view = s.e.public(s.r, s.p[1]);
  assert.equal(view.players[0].clue, null);
  assert.equal(view.players[1].clue, 'Minha dica nova');
  assert(view.history.every((h) => h.clues.every((c) => c.playerId === s.p[1].playerId)));
  assert(!JSON.stringify(view).includes('Histórico reservado'));
  assert(!JSON.stringify(view).includes('Segredo da rodada seguinte'));
  s.e.resume(s.r.code, s.p[1].token!, 'again');
  assert.equal(s.state(1).effects.blindRound, 2);
  s.cast(2, 'prometheus', 1);
  assert.equal(s.e.public(s.r, s.p[1]).players[0].clue, 'Segredo da rodada seguinte');
});

test('mão suspende apenas um poder comum, mantém vestígio e não revela a escolha ao atacante', async (t) => {
  const s = await fixture(t, [['oracle', 'refuge', 'aegis'], ['divine_hand'], ['divine_hand']]);
  s.cast(1, 'divine_hand', 0);
  assert.equal(s.state(0).powers.filter((p) => p.blockedUntilRound === 2).length, 1);
  assert(!s.state(0).exclusivePower?.blockedUntilRound);
  assert(!s.state(1).notifications.at(-1)!.message.includes('Oráculo'));
  rejects(() => s.cast(0, 'oracle', 3), 'POWER_SUSPENDED');
  rejects(() => s.cast(2, 'divine_hand', 0), 'EFFECT_ACTIVE');
  assert.equal(s.state(2).usedPowerRound, 0);
  await s.next();
  rejects(() => s.cast(0, 'oracle', 3), 'POWER_SUSPENDED');
  await s.next();
  s.cast(0, 'oracle', 3);
});

test('o escolhido impede votos, permite abstenção e rejeita ativação com votação aberta', async (t) => {
  const s = await fixture(t, [['chosen'], [], ['chosen'], ['ban_vote']]);
  s.cast(0, 'chosen', 1);
  s.cast(3, 'ban_vote', 4);
  s.open();
  rejects(() => s.vote(2, 1), 'INVALID_TARGET');
  rejects(() => s.cast(2, 'chosen', 2), 'POWER_WINDOW');
  assert.equal(s.state(2).usedPowerRound, 0);
  s.vote(2, null);
  rejects(() => s.vote(4, null), 'VOTE_BANNED');
  await s.close();
  assert.equal(s.r.voteResult!.abstentions, 1);
  assert.equal(s.r.voteResult!.eliminatedId, null);
});

test('abstenção é secreta, idempotente, persiste na reconexão e não disputa votos', async (t) => {
  const s = await fixture(t);
  s.open();
  const ballotId = s.r.ballotId!,
    requestId = randomUUID();
  s.vote(0, null, { requestId });
  s.vote(0, null, { requestId });
  assert.equal(s.r.votes.size, 1);
  assert(s.e.public(s.r).players[0].voted);
  assert(!JSON.stringify(s.e.public(s.r)).includes('abstentions'));
  assert.deepEqual(s.state(0).ballot, { ballotId, targetId: null });
  rejects(() => s.vote(0, 1), 'ALREADY_VOTED');
  s.e.resume(s.r.code, s.p[0].token!, 'reload');
  assert.equal(s.state(0).ballot!.targetId, null);
  for (let i = 1; i < 7; i++) s.vote(i, null);
  s.vote(7, 1);
  await s.close();
  assert.equal(s.r.voteResult!.abstentions, 7);
  assert.equal(s.r.voteResult!.eliminatedId, s.p[1].playerId);
});

test('todos pulam: sem eliminação e sem consumir égide; pedidos atrasados não atingem nova votação', async (t) => {
  const s = await fixture(t, [['aegis']]);
  s.cast(0, 'aegis', 1);
  s.open();
  const old = s.r.ballotId!;
  for (let i = 0; i < 8; i++) s.vote(i, null);
  await s.close();
  assert.equal(s.r.voteResult!.abstentions, 8);
  assert(s.r.voteResult!.noVotes);
  assert(s.state(1).effects.aegis);
  await s.next();
  s.open();
  rejects(() => s.vote(0, null, { ballotId: old }), 'STALE_BALLOT');
  assert.equal(s.r.votes.size, 0);
  s.vote(0, null);
});

test('desempate permite nova abstenção e mantém votos anteriores imutáveis', async (t) => {
  const s = await fixture(t);
  s.open();
  s.vote(2, 0);
  s.vote(3, 1);
  s.vote(4, null);
  await s.close();
  assert.equal(s.r.phase, 'TIEBREAK');
  s.open();
  assert.equal(s.state(4).ballot, null);
  s.vote(4, null);
  s.vote(2, 0);
  await s.close();
  assert.equal(s.r.history[0].votes[0].abstentions, 1);
  assert.equal(s.r.history[0].votes[1].abstentions, 1);
  assert.equal(s.r.voteResult!.eliminatedId, s.p[0].playerId);
});

for (const power of [
  'labyrinth',
  'dice',
  'name_swap',
  'void_eye',
  'divine_hand',
  'confusion',
] as PowerId[])
  test(
    'refúgio absorve novo poder ' + power + ' sem aplicar efeito e sem identificar atacante',
    async (t) => {
      const s = await fixture(t, [[power], ['refuge']]);
      s.cast(1, 'refuge');
      const before = s.state(1).effects;
      s.cast(0, power, 1);
      const after = s.state(1).effects;
      assert.deepEqual(after, { ...before, refuge: false });
      assert.equal(s.state(0).powers[0].readyRound, 5);
      const victim = JSON.stringify(s.state(1).notifications);
      assert(!victim.includes(s.p[0].playerId!));
      assert(!victim.includes(s.r.players[0].name));
    },
  );

test('fogo cura penalidade agendada sem alterar recarga e protege escolha privada', async (t) => {
  const s = await fixture(t, [['void_eye'], ['prometheus']]);
  s.cast(0, 'void_eye', 1);
  assert.equal(s.state(1).effects.blindRound, 2);
  s.cast(1, 'prometheus', 1);
  assert.equal(s.state(1).effects.blindRound, 0);
  assert.equal(s.state(0).powers[0].readyRound, 5);
  await s.next();
  assert.equal(s.e.public(s.r, s.p[1]).players[0].clue, null);
});
