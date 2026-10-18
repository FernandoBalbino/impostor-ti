import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  PROTOCOL_VERSION,
  POWER_IDS,
  type Command,
  type PowerId,
  type PrivateState,
} from '@impostor/shared';
import { GameEngine, GameError } from '../apps/server/src/engine.js';
import { until } from '../scripts/clients.js';
type PlayerState = Extract<PrivateState, { kind: 'player' }>;
type Options = {
  n?: number;
  impostors?: 1 | 2 | 3;
  loadouts?: Record<number, PowerId[]>;
  engine?: ConstructorParameters<typeof GameEngine>[0];
};
async function fixture(t: { after: (fn: () => void) => void }, options: Options = {}) {
  const engine = new GameEngine({ revealMs: 1, resultMs: 1, ...options.engine });
  t.after(() => engine.close());
  const teacher = engine.create('teacher').auth;
  const room = engine.room(teacher.code);
  const players = Array.from(
    { length: options.n ?? 8 },
    (_, i) => engine.join(room.code, `Pessoa ${i}`, i, `socket${i}`).auth,
  );
  const send = (auth: typeof teacher, data: Record<string, unknown>) =>
    engine.execute(auth, {
      protocolVersion: PROTOCOL_VERSION,
      ...data,
      requestId: data.requestId ?? randomUUID(),
    } as Command);
  for (let i = 0; i < players.length; i++) {
    send(players[i], {
      type: 'player:powers',
      powers: options.loadouts?.[i] ?? ['double_vote', 'refuge'],
    });
    send(players[i], { type: 'player:ready', ready: true, avatar: i });
  }
  send(teacher, {
    type: 'teacher:settings',
    settings: {
      ...room.settings,
      clueSeconds: 300,
      selectionMode: 'manual',
      impostorCount: options.impostors ?? 1,
    },
    manualImpostorIds: players.slice(0, options.impostors ?? 1).map((p) => p.playerId),
  });
  send(teacher, { type: 'game:start' });
  await until(() => room.phase === 'CLUES');
  const state = (i: number) => engine.privateState(room, players[i]) as PlayerState;
  const cast = (i: number, powerId: PowerId, target?: number, text?: string, requestId?: string) =>
    send(players[i], {
      type: 'power:activate',
      powerId,
      ...(target === undefined ? {} : { targetId: players[target].playerId }),
      ...(text === undefined ? {} : { text }),
      ...(requestId ? { requestId } : {}),
    });
  const clue = (i: number, text = 'Um recurso útil') =>
    send(players[i], { type: 'clue:submit', text });
  const open = () => {
    if (room.phase === 'CLUES') send(teacher, { type: 'clues:close' });
    send(teacher, { type: 'vote:open' });
  };
  const vote = (i: number, target: number) =>
    send(players[i], { type: 'vote:submit', targetId: players[target].playerId });
  const close = async () => {
    send(teacher, { type: 'vote:close' });
    await until(() => ['WAITING_FOR_NEXT_ROUND', 'TIEBREAK', 'GAME_OVER'].includes(room.phase));
  };
  const next = async () => {
    if (room.phase === 'CLUES') open();
    if (room.phase === 'VOTING') await close();
    send(teacher, { type: 'round:next' });
  };
  return { engine, teacher, room, players, send, state, cast, clue, open, vote, close, next };
}
const rejects = (fn: () => unknown, code: string) =>
  assert.throws(fn, (e: unknown) => e instanceof GameError && e.code === code);

test('dois poderes distintos são obrigatórios e a escolha fica travada na partida', async (t) => {
  const engine = new GameEngine();
  t.after(() => engine.close());
  const teacher = engine.create('t').auth;
  const room = engine.room(teacher.code);
  const p = engine.join(room.code, 'Aluno', 0, 's').auth;
  const send = (data: Record<string, unknown>) =>
    engine.execute(p, { ...data, requestId: randomUUID(), protocolVersion: 2 } as Command);
  rejects(() => send({ type: 'player:ready', ready: true, avatar: 0 }), 'CHOOSE_POWERS');
  rejects(() => send({ type: 'player:powers', powers: ['oracle', 'oracle'] }), 'INVALID_POWERS');
  rejects(
    () => send({ type: 'player:powers', powers: ['oracle', 'aegis', 'refuge'] }),
    'INVALID_POWERS',
  );
  send({ type: 'player:powers', powers: ['oracle', 'refuge'] });
  send({ type: 'player:ready', ready: true, avatar: 0 });
  send({ type: 'player:powers', powers: ['aegis', 'refuge'] });
  assert.equal(room.players[0].ready, false);
  const s = await fixture(t);
  rejects(
    () => s.send(s.players[0], { type: 'player:powers', powers: ['aegis', 'refuge'] }),
    'WRONG_PHASE',
  );
});

for (const impostors of [1, 2, 3] as const) {
  test(`${impostors} impostor(es): papéis, aliados privados e vitória por igualdade`, async (t) => {
    const s = await fixture(t, { n: impostors * 2 + 1, impostors });
    assert.equal(s.room.impostorIds.length, impostors);
    for (let i = 0; i < impostors; i++)
      assert.deepEqual(s.state(i).impostorIds, s.room.impostorIds);
    assert.deepEqual(s.state(impostors).impostorIds, []);
    assert.equal(s.state(0).word, null);
    const pub = JSON.stringify(s.engine.public(s.room));
    assert(!pub.includes('impostorIds'));
    assert(!pub.includes('powers'));
    assert(!pub.includes('notifications'));
    s.open();
    s.vote(0, impostors);
    await s.close();
    assert.equal(s.room.result?.winner, 'impostor');
    assert.equal(s.room.result?.impostorIds.length, impostors);
  });
  test(`${impostors} impostor(es): não inicia com menos de ${impostors * 2 + 1} alunos`, async (t) => {
    await assert.rejects(
      () => fixture(t, { n: impostors * 2, impostors }),
      (e: unknown) => e instanceof GameError && e.code === 'NOT_ENOUGH_PLAYERS',
    );
  });
}
test('civis precisam eliminar todos os três impostores', async (t) => {
  const s = await fixture(t, { n: 8, impostors: 3 });
  for (let target = 0; target < 3; target++) {
    s.open();
    s.vote(7, target);
    await s.close();
    if (target < 2) {
      assert.equal(s.room.result, null);
      await s.next();
    }
  }
  assert.equal(s.room.result?.winner, 'civis');
});

test('recarga independente: uso na 1 volta na 5; só uma ativação por rodada', async (t) => {
  const s = await fixture(t, { loadouts: { 0: ['oracle', 'double_vote'] } });
  s.cast(0, 'oracle', 1);
  assert.equal(s.state(0).powers[0].readyRound, 5);
  rejects(() => s.cast(0, 'double_vote'), 'ONE_POWER_PER_ROUND');
  await s.next();
  s.cast(0, 'double_vote');
  await s.next();
  rejects(() => s.cast(0, 'oracle', 1), 'POWER_COOLDOWN');
  await s.next();
  rejects(() => s.cast(0, 'oracle', 1), 'POWER_COOLDOWN');
  await s.next();
  s.cast(0, 'oracle', 1);
  assert.equal(s.state(0).powers[0].readyRound, 9);
});

for (const result of [0, 1])
  test(`oráculo ${result ? 'revela o papel' : 'fracassa'} e não sorteia de novo ao repetir pedido`, async (t) => {
    let rolls = 0;
    const s = await fixture(t, {
      loadouts: { 1: ['oracle', 'refuge'] },
      engine: {
        random: () => {
          rolls++;
          return result;
        },
      },
    });
    const id = randomUUID();
    const first = s.cast(1, 'oracle', 0, undefined, id);
    const second = s.cast(1, 'oracle', 0, undefined, id);
    assert.deepEqual(second, first);
    assert.equal(rolls, 1);
    assert.equal(s.state(1).usedPowerRound, 1);
    assert.equal(s.state(1).notifications.length, 1);
    assert.match(first.activation!.message, result ? /Impostor/ : /leitura falhou/);
    assert(!JSON.stringify(s.state(0).notifications).includes('Pessoa 1'));
    s.engine.disconnect(s.players[1], 'socket1');
    const resumed = s.engine.resume(s.room.code, s.players[1].token!, 'new');
    assert.deepEqual(
      s.engine.execute(resumed, {
        type: 'power:activate',
        powerId: 'oracle',
        targetId: s.players[0].playerId,
        protocolVersion: 2,
        requestId: id,
      }),
      first,
    );
    assert.equal(rolls, 1);
  });

test('silêncio dura 20 segundos e preserva a possibilidade de enviar depois', async (t) => {
  let now = Date.now();
  const s = await fixture(t, {
    loadouts: { 0: ['silence', 'refuge'] },
    engine: { now: () => now },
  });
  s.cast(0, 'silence', 1);
  assert.equal(s.state(1).effects.silencedUntil, now + 20_000);
  rejects(() => s.clue(1), 'SILENCED');
  now += 19_999;
  rejects(() => s.clue(1), 'SILENCED');
  now++;
  s.clue(1);
  assert.equal(s.state(1).clueSubmitted, true);
});
test('letra proibida considera acentos, persiste até a próxima dica e só é consumida no envio válido', async (t) => {
  const s = await fixture(t, {
    loadouts: { 0: ['letter', 'refuge'] },
    engine: { random: () => 0 },
  });
  s.clue(1);
  s.cast(0, 'letter', 1);
  await s.next();
  rejects(() => s.clue(1, 'Árvore'), 'FORBIDDEN_LETTER');
  assert.equal(s.state(1).effects.forbiddenLetter, 'A');
  s.clue(1, 'É útil');
  assert.equal(s.state(1).effects.forbiddenLetter, null);
});
test('eco falso é substituído pela dica verdadeira e não encerra a coleta', async (t) => {
  const s = await fixture(t, { loadouts: { 0: ['echo', 'refuge'] } });
  s.cast(0, 'echo', 1, 'Uma pista inventada');
  assert.equal(s.engine.public(s.room).players[1].clue, 'Uma pista inventada');
  assert.equal(s.state(1).clueSubmitted, false);
  assert.equal(s.engine.public(s.room).clueCount, 0);
  assert(!JSON.stringify(s.engine.public(s.room)).includes('fakeClue'));
  for (let i = 0; i < s.players.length; i++) if (i !== 1) s.clue(i);
  assert.equal(s.room.phase, 'CLUES');
  s.clue(1, 'Minha pista verdadeira');
  assert.equal(s.room.phase, 'WAITING_FOR_VOTE');
  assert.equal(s.engine.public(s.room).players[1].clue, 'Minha pista verdadeira');
});

test('tábula rasa garante 20 segundos só ao alvo após o prazo geral', async (t) => {
  let now = Date.now();
  const s = await fixture(t, { loadouts: { 0: ['erase', 'refuge'] }, engine: { now: () => now } });
  s.clue(1);
  now = s.room.clueDeadline! - 2;
  s.cast(0, 'erase', 1);
  const personal = s.state(1).clueDeadline!;
  assert.equal(personal, now + 20_000);
  s.send(s.teacher, { type: 'clues:close' });
  assert.equal(s.room.phase, 'CLUES');
  rejects(() => s.clue(2), 'TIME_UP');
  rejects(() => s.send(s.teacher, { type: 'vote:open' }), 'WRONG_PHASE');
  now += 19_999;
  s.clue(1, 'Outra pista verdadeira');
  assert.equal(s.room.phase, 'WAITING_FOR_VOTE');
});
test('fim automático do prazo extra não depende de novas mensagens', async (t) => {
  const s = await fixture(t, { loadouts: { 0: ['erase', 'refuge'] }, engine: { effectMs: 45 } });
  s.clue(1);
  s.cast(0, 'erase', 1);
  s.send(s.teacher, { type: 'clues:close' });
  await until(() => s.room.phase === 'WAITING_FOR_VOTE');
  assert.equal(s.state(1).clueSubmitted, false);
});
test('silêncio combinado com reescrita mantém 20 segundos após o silêncio', async (t) => {
  let now = Date.now();
  const s = await fixture(t, {
    loadouts: { 0: ['erase', 'refuge'], 2: ['silence', 'refuge'] },
    engine: { now: () => now },
  });
  s.clue(1);
  s.cast(0, 'erase', 1);
  now += 3000;
  s.cast(2, 'silence', 1);
  assert.equal(s.state(1).clueDeadline, now + 40_000);
  s.send(s.teacher, { type: 'clues:close' });
  now += 20_001;
  s.clue(1);
  assert.equal(s.room.phase, 'WAITING_FOR_VOTE');
});

for (const power of ['silence', 'letter', 'ban_vote', 'oracle', 'echo', 'erase', 'veil'] as const)
  test(`refúgio absorve ${power} sem revelar autor e cobra o atacante`, async (t) => {
    const s = await fixture(t, {
      loadouts: { 0: [power, 'double_vote'], 1: ['refuge', 'double_vote'] },
    });
    if (power === 'erase') s.clue(1);
    s.cast(1, 'refuge');
    s.cast(0, power, 1, power === 'echo' ? 'Pista falsa' : undefined);
    assert.equal(s.state(1).effects.refuge, false);
    assert.equal(s.state(0).usedPowerRound, 1);
    assert.equal(s.state(0).powers[0].readyRound, 5);
    assert.match(s.state(0).notifications.at(-1)!.message, /absorvido/);
    assert(!JSON.stringify(s.state(1).notifications).includes('Pessoa 0'));
    assert.equal(s.state(1).effects.forbiddenLetter, null);
    if (power === 'erase') assert.equal(s.state(1).clueSubmitted, true);
  });
test('refúgio persiste, não bloqueia proteção benéfica e sua absorção é passiva', async (t) => {
  const s = await fixture(t, {
    loadouts: { 0: ['silence', 'refuge'], 1: ['refuge', 'double_vote'], 2: ['aegis', 'refuge'] },
  });
  s.cast(1, 'refuge');
  s.cast(2, 'aegis', 1);
  assert.equal(s.state(1).effects.refuge, true);
  await s.next();
  s.cast(0, 'silence', 1);
  s.cast(1, 'double_vote');
  assert.equal(s.state(1).effects.aegis, true);
  assert.equal(s.state(1).effects.refuge, false);
});
test('efeitos repetidos e alvos inválidos não gastam a ativação', async (t) => {
  const s = await fixture(t, { loadouts: { 0: ['silence', 'refuge'], 2: ['silence', 'letter'] } });
  s.cast(0, 'silence', 1);
  rejects(() => s.cast(2, 'silence', 1), 'EFFECT_ACTIVE');
  assert.equal(s.state(2).usedPowerRound, 0);
  assert.equal(s.state(2).powers[0].readyRound, 0);
  rejects(() => s.cast(2, 'silence', 2), 'INVALID_TARGET');
  s.cast(2, 'letter', 1);
  assert(s.state(1).effects.silencedUntil > 0);
  assert(s.state(1).effects.forbiddenLetter);
});
test('poderes de dica não funcionam na conversa; eliminados e telão não ativam', async (t) => {
  const s = await fixture(t, { loadouts: { 0: ['silence', 'echo'] } });
  s.open();
  rejects(() => s.cast(0, 'silence', 1), 'POWER_WINDOW');
  s.room.players[1].alive = false;
  rejects(() => s.cast(1, 'refuge'), 'ELIMINATED');
  rejects(
    () =>
      s.send({ code: s.room.code, kind: 'display' }, { type: 'power:activate', powerId: 'refuge' }),
    'FORBIDDEN',
  );
});

test('voto dobrado e exílio duram no desempate sem permitir outra ativação', async (t) => {
  const s = await fixture(t, {
    loadouts: { 0: ['double_vote', 'refuge'], 5: ['ban_vote', 'refuge'] },
  });
  s.cast(0, 'double_vote');
  s.cast(5, 'ban_vote', 6);
  s.open();
  assert.equal(s.engine.public(s.room).eligibleVoters, 7);
  rejects(() => s.vote(6, 3), 'VOTE_BANNED');
  s.vote(0, 3);
  s.vote(1, 4);
  s.vote(2, 4);
  await s.close();
  assert.equal(s.room.phase, 'TIEBREAK');
  rejects(() => s.cast(0, 'refuge'), 'ONE_POWER_PER_ROUND');
  s.send(s.teacher, { type: 'vote:open' });
  rejects(() => s.vote(6, 3), 'VOTE_BANNED');
  s.vote(0, 3);
  s.vote(1, 4);
  await s.close();
  assert.equal(s.room.voteResult!.counts[s.players[3].playerId!], 2);
  await s.next();
  assert.equal(s.engine.public(s.room).eligibleVoters, 7);
});
test('peso e exílio não alteram um voto já confirmado', async (t) => {
  const s = await fixture(t, { loadouts: { 2: ['ban_vote', 'refuge'] } });
  s.open();
  s.vote(0, 3);
  rejects(() => s.cast(0, 'double_vote'), 'ALREADY_VOTED');
  rejects(() => s.cast(2, 'ban_vote', 0), 'ALREADY_VOTED');
  assert.equal(s.state(0).usedPowerRound, 0);
  assert.equal(s.state(2).usedPowerRound, 0);
});
test('todos impedidos de votar: votação sem votos avança sem eliminação', async (t) => {
  const loadouts = Object.fromEntries(
    Array.from({ length: 8 }, (_, i) => [i, ['ban_vote', 'refuge']]),
  ) as Record<number, PowerId[]>;
  const s = await fixture(t, { loadouts });
  for (let i = 0; i < 8; i++) s.cast(i, 'ban_vote', (i + 1) % 8);
  assert.equal(s.engine.public(s.room).eligibleVoters, 0);
  s.open();
  await s.close();
  assert.equal(s.room.voteResult?.noVotes, true);
  assert.equal(s.room.eliminations.length, 0);
});
test('égide impede a eliminação do impostor, não transfere a eliminação e só pode ser ativada uma vez', async (t) => {
  const s = await fixture(t, { loadouts: { 0: ['aegis', 'double_vote'], 2: ['aegis', 'refuge'] } });
  s.cast(0, 'aegis', 0);
  rejects(() => s.cast(2, 'aegis', 0), 'EFFECT_ACTIVE');
  assert.equal(s.state(2).usedPowerRound, 0);
  s.open();
  s.vote(1, 0);
  await s.close();
  assert.equal(s.room.voteResult?.protectedId, s.players[0].playerId);
  assert.equal(s.room.voteResult?.eliminatedId, null);
  assert.equal(s.room.eliminations.length, 0);
  assert.equal(s.room.result, null);
  await s.next();
  rejects(() => s.cast(0, 'aegis', 0), 'POWER_SPENT');
});
test('empate não consome égide; desempate consome quando impediria eliminação', async (t) => {
  const s = await fixture(t, { loadouts: { 0: ['aegis', 'refuge'] } });
  s.cast(0, 'aegis', 3);
  s.open();
  s.vote(1, 3);
  s.vote(2, 4);
  await s.close();
  assert.equal(s.state(3).effects.aegis, true);
  s.send(s.teacher, { type: 'vote:open' });
  s.vote(1, 3);
  await s.close();
  assert.equal(s.state(3).effects.aegis, false);
  assert.equal(s.room.voteResult?.protectedId, s.players[3].playerId);
});
test('véu esconde só a imagem da próxima rodada e não revela papéis', async (t) => {
  const s = await fixture(t, { loadouts: { 0: ['veil', 'refuge'], 2: ['veil', 'refuge'] } });
  const word = s.state(1).word!.nome;
  s.cast(0, 'veil', 1);
  assert.deepEqual(s.state(1).effects.hiddenImageRounds, [2]);
  rejects(() => s.cast(2, 'veil', 1), 'EFFECT_ACTIVE');
  await s.next();
  assert.equal(s.state(1).word!.nome, word);
  s.cast(2, 'veil', 1);
  assert.deepEqual(s.state(1).effects.hiddenImageRounds, [2, 3]);
  await s.next();
  assert.deepEqual(s.state(1).effects.hiddenImageRounds, [3]);
});
test('nova partida mantém escolhas e limpa efeitos, recargas e resultados privados', async (t) => {
  const s = await fixture(t, { loadouts: { 0: ['oracle', 'aegis'] } });
  s.cast(0, 'oracle', 1);
  s.send(s.teacher, { type: 'game:end' });
  s.send(s.teacher, { type: 'game:reset' });
  const state = s.state(0);
  assert.deepEqual(
    state.powers.map((p) => p.id),
    ['oracle', 'aegis'],
  );
  assert(state.powers.every((p) => !p.used && p.readyRound === 0));
  assert.deepEqual(state.notifications, []);
  assert.deepEqual(state.impostorIds, []);
  assert.equal(state.usedPowerRound, 0);
});
test('catálogo tem dez poderes distintos', () => assert.equal(new Set(POWER_IDS).size, 10));
