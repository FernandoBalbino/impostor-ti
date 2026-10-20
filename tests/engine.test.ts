import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import { CATEGORIES, type Command } from '@impostor/shared';
import { CATALOG } from '../apps/server/src/catalog.js';
import { GameEngine, GameError, normalize, type Auth } from '../apps/server/src/engine.js';
const pause = (ms = 60) => new Promise((r) => setTimeout(r, ms));
function setup(n = 4, options: ConstructorParameters<typeof GameEngine>[0] = {}) {
  const engine = new GameEngine({ revealMs: 2, resultMs: 2, ...options });
  const teacher = engine.create('teacher').auth;
  const room = engine.room(teacher.code);
  const players = Array.from(
    { length: n },
    (_, i) => engine.join(room.code, `Aluno ${i + 1}`, i % 24, `s${i}`).auth,
  );
  const command = (auth: Auth, cmd: Record<string, unknown>) =>
    engine.execute(auth, { ...(cmd.type==='vote:submit'?{ballotId:room.ballotId}:{}), ...cmd, requestId: randomUUID() } as Command);
  for (const p of players) command(p, { type: 'player:powers', powers: ['double_vote', 'refuge', 'oracle'] });
  const settings = () =>
    command(teacher, {
      type: 'teacher:settings',
      settings: { ...room.settings, selectionMode: 'manual' },
      manualImpostorIds: [players[0].playerId],
    });
  const start = async () => {
    for (const p of players) command(p, { type: 'player:ready', ready: true, avatar: 0 });
    settings();
    command(teacher, { type: 'game:start' });
    await pause();
  };
  const closeClues = () => command(teacher, { type: 'clues:close' });
  const vote = async (target: string) => {
    closeClues();
    command(teacher, { type: 'vote:open' });
    const voter = players.find(
      (p) => p.playerId !== target && room.players.find((x) => x.id === p.playerId)?.alive,
    )!;
    command(voter, { type: 'vote:submit', targetId: target });
    command(teacher, { type: 'vote:close' });
    await pause();
  };
  return { engine, teacher, players, room, command, settings, start, closeClues, vote };
}
const rejects = (fn: () => void, code: string) =>
  assert.throws(fn, (e: unknown) => e instanceof GameError && e.code === code);
test('temporizador encerra a coleta mesmo sem novas mensagens dos alunos', async () => {
  const s = setup();
  try {
    s.room.settings.clueSeconds = 0.005;
    await s.start();
    assert.equal(s.room.phase, 'WAITING_FOR_VOTE');
    assert.equal(s.room.deadline, null);
    assert.ok(s.room.history[0].clues.every((c) => c.text === 'Sem dica'));
  } finally {
    s.engine.close();
  }
});
test('catálogo contém 60 palavras únicas, os exemplos e conceitos básicos', async () => {
  assert.equal(CATALOG.length, 60);
  assert.equal(new Set(CATALOG.map((w) => w.id)).size, 60);
  for (const name of [
    'Mouse',
    'Memória RAM',
    'Antivírus',
    'Editor de texto',
    'Google Chrome',
    'Brave',
    'Windows 10',
    'macOS',
    'Pasta',
    'Arquivo',
    'Lixeira',
    'Wi-Fi',
  ])
    assert.ok(CATALOG.some((w) => w.nome === name));
  for (const w of CATALOG) await access(new URL(`../apps/web/public/${w.imagem}`, import.meta.url));
});
test('cria sala de seis caracteres e credencial imprevisível', () => {
  const s = setup();
  try {
    assert.match(s.room.code, /^[A-Z2-9]{6}$/);
    assert.ok(s.teacher.token!.length >= 43);
    assert.equal(s.engine.public(s.room).players.length, 4);
    assert.equal(s.room.settings.clueSeconds, 60);
  } finally {
    s.engine.close();
  }
});
test('limita a sala a 24 alunos', () => {
  const s = setup(24);
  try {
    rejects(() => s.engine.join(s.room.code, 'Aluno extra', 1, 'extra'), 'ROOM_FULL');
  } finally {
    s.engine.close();
  }
});
test('normaliza nome, acentos e espaços para impedir duplicação', () => {
  const s = setup(0);
  try {
    s.engine.join(s.room.code, '  João   Silva ', 1, 'a');
    rejects(() => s.engine.join(s.room.code, 'JOAO SILVA', 2, 'b'), 'DUPLICATE_NAME');
    assert.equal(normalize('MEMÓRIA-RAM'), 'memoria ram');
  } finally {
    s.engine.close();
  }
});
test('bloqueia início sem três alunos e sem preparação', () => {
  const s = setup(2);
  try {
    rejects(() => s.command(s.teacher, { type: 'game:start' }), 'NOT_ENOUGH_PLAYERS');
    s.engine.join(s.room.code, 'Terceiro', 2, 'extra');
    rejects(() => s.command(s.teacher, { type: 'game:start' }), 'NOT_READY');
  } finally {
    s.engine.close();
  }
});
test('define um impostor manual e entrega palavra somente a civis e professor', async () => {
  const s = setup();
  try {
    await s.start();
    assert.deepEqual(s.room.impostorIds, [s.players[0].playerId]);
    const secret = s.room.word!;
    const imp = s.engine.privateState(s.room, s.players[0]);
    assert.equal(imp.kind === 'player' && imp.role, 'impostor');
    assert.equal('word' in imp ? imp.word : undefined, null);
    const serialized = JSON.stringify({ room: s.engine.public(s.room), private: imp });
    assert.ok(!serialized.includes(secret.id + '"'));
    assert.ok(!serialized.includes(secret.imagem));
    assert.ok(!serialized.includes('teacherToken'));
    assert.ok(!serialized.includes(s.teacher.token!));
    assert.equal((s.engine.privateState(s.room, s.players[1]) as any).word.id, secret.id);
    assert.equal((s.engine.privateState(s.room, s.teacher) as any).word.id, secret.id);
    assert.deepEqual(s.engine.privateState(s.room, { kind: 'display', code: s.room.code }), {
      kind: 'display',
    });
  } finally {
    s.engine.close();
  }
});
test('sorteio automático escolhe exatamente um jogador válido', async () => {
  const s = setup();
  try {
    for (const p of s.players) s.command(p, { type: 'player:ready', ready: true, avatar: 0 });
    s.command(s.teacher, { type: 'game:start' });
    assert.equal(
      s.players.filter((p) => (s.engine.privateState(s.room, p) as any).role === 'impostor').length,
      1,
    );
  } finally {
    s.engine.close();
  }
});
test('seleção manual exige um jogador elegível', () => {
  const s = setup();
  try {
    for (const p of s.players) s.command(p, { type: 'player:ready', ready: true, avatar: 0 });
    rejects(
      () =>
        s.command(s.teacher, {
          type: 'teacher:settings',
          settings: { ...s.room.settings, selectionMode: 'manual' },
          manualImpostorIds: ['invalid'],
        }),
      'SELECT_IMPOSTOR',
    );
  } finally {
    s.engine.close();
  }
});
test('valida dicas vazias, comprimento, palavra literal normalizada e duplicações', async () => {
  const s = setup();
  try {
    await s.start();
    const p = s.players[1];
    rejects(() => s.command(p, { type: 'clue:submit', text: '   ' }), 'INVALID_CLUE');
    rejects(() => s.command(p, { type: 'clue:submit', text: 'x'.repeat(81) }), 'INVALID_CLUE');
    rejects(
      () =>
        s.command(p, {
          type: 'clue:submit',
          text: `Uso ${normalize(s.room.word!.nome).toUpperCase()} todos os dias`,
        }),
      'WORD_IN_CLUE',
    );
    s.command(p, { type: 'clue:submit', text: 'Uma pista para investigar' });
    rejects(() => s.command(p, { type: 'clue:submit', text: 'Outra pista' }), 'ALREADY_SUBMITTED');
  } finally {
    s.engine.close();
  }
});
test('o impostor não recebe um oráculo de comparação da palavra secreta', async () => {
  const s = setup();
  try {
    await s.start();
    s.command(s.players[0], { type: 'clue:submit', text: s.room.word!.nome });
    assert.equal(s.room.players[0].clue, s.room.word!.nome);
  } finally {
    s.engine.close();
  }
});
test('todos responderam encerra dicas sem abrir votação', async () => {
  const s = setup();
  try {
    await s.start();
    for (const p of s.players) s.command(p, { type: 'clue:submit', text: 'Uma pista válida' });
    assert.equal(s.room.phase, 'WAITING_FOR_VOTE');
    assert.equal(s.room.deadline, null);
  } finally {
    s.engine.close();
  }
});
test('prazo do servidor bloqueia dica atrasada e registra sem dica', async () => {
  let now = Date.now();
  const s = setup(4, { now: () => now });
  try {
    await s.start();
    now = s.room.deadline! + 1;
    rejects(
      () => s.command(s.players[1], { type: 'clue:submit', text: 'Cheguei tarde' }),
      'TIME_UP',
    );
    assert.equal(s.room.phase, 'WAITING_FOR_VOTE');
    assert.ok(s.room.history[0].clues.every((c) => c.text === 'Sem dica'));
  } finally {
    s.engine.close();
  }
});
test('votos são secretos, únicos e não podem ser próprios', async () => {
  const s = setup();
  try {
    await s.start();
    s.closeClues();
    s.command(s.teacher, { type: 'vote:open' });
    rejects(
      () => s.command(s.players[0], { type: 'vote:submit', targetId: s.players[0].playerId }),
      'SELF_VOTE',
    );
    s.command(s.players[0], { type: 'vote:submit', targetId: s.players[1].playerId });
    assert.equal(s.engine.public(s.room).voteResult, null);
    assert.deepEqual(s.engine.public(s.room).history[0].votes, []);
    rejects(
      () => s.command(s.players[0], { type: 'vote:submit', targetId: s.players[2].playerId }),
      'ALREADY_VOTED',
    );
  } finally {
    s.engine.close();
  }
});
test('desempate só aceita candidatos empatados e novo empate não elimina', async () => {
  const s = setup();
  try {
    await s.start();
    s.closeClues();
    s.command(s.teacher, { type: 'vote:open' });
    s.command(s.players[2], { type: 'vote:submit', targetId: s.players[0].playerId });
    s.command(s.players[3], { type: 'vote:submit', targetId: s.players[1].playerId });
    s.command(s.teacher, { type: 'vote:close' });
    await pause();
    assert.equal(s.room.phase, 'TIEBREAK');
    s.command(s.teacher, { type: 'vote:open' });
    rejects(
      () => s.command(s.players[0], { type: 'vote:submit', targetId: s.players[2].playerId }),
      'INVALID_TARGET',
    );
    s.command(s.players[2], { type: 'vote:submit', targetId: s.players[0].playerId });
    s.command(s.players[3], { type: 'vote:submit', targetId: s.players[1].playerId });
    s.command(s.teacher, { type: 'vote:close' });
    await pause();
    assert.equal(s.room.phase, 'WAITING_FOR_NEXT_ROUND');
    assert.equal(s.room.eliminations.length, 0);
  } finally {
    s.engine.close();
  }
});
test('votação sem votos não elimina ninguém', async () => {
  const s = setup();
  try {
    await s.start();
    s.closeClues();
    s.command(s.teacher, { type: 'vote:open' });
    s.command(s.teacher, { type: 'vote:close' });
    await pause();
    assert.equal(s.room.phase, 'WAITING_FOR_NEXT_ROUND');
    assert.equal(s.room.eliminations.length, 0);
  } finally {
    s.engine.close();
  }
});
test('eliminar civil mantém impostor e partida; próxima rodada troca a palavra e eliminado não age', async () => {
  const s = setup();
  try {
    await s.start();
    const word = s.room.word!.id;
    await s.vote(s.players[1].playerId!);
    assert.equal(s.room.phase, 'WAITING_FOR_NEXT_ROUND');
    assert.equal(s.room.result, null);
    s.command(s.teacher, { type: 'round:next' });
    assert.notEqual(s.room.word!.id, word);
    assert.equal((s.engine.privateState(s.room, s.players[0]) as any).word, null);
    assert.equal((s.engine.privateState(s.room, s.players[2]) as any).word.id, s.room.word!.id);
    rejects(
      () => s.command(s.players[1], { type: 'clue:submit', text: 'Uma pista' }),
      'ELIMINATED',
    );
    s.closeClues();
    s.command(s.teacher, { type: 'vote:open' });
    rejects(
      () => s.command(s.players[1], { type: 'vote:submit', targetId: s.players[0].playerId }),
      'ELIMINATED',
    );
    rejects(
      () => s.command(s.players[0], { type: 'vote:submit', targetId: s.players[1].playerId }),
      'INVALID_TARGET',
    );
    assert.equal(
      s.engine.public(s.room).players.find((p) => p.id === s.players[1].playerId)!.alive,
      false,
    );
  } finally {
    s.engine.close();
  }
});
test('rodadas esgotam a categoria antes de repetir e limpam a pista do item anterior', async () => {
  const s = setup();
  try {
    s.room.settings.categories = ['Navegadores'];
    await s.start();
    const seen = new Set([s.room.word!.id]);
    const total = CATALOG.filter((w) => w.categoria === 'Navegadores').length;
    assert.ok(total > 1);
    for (let round = 1; round <= total; round++) {
      const previous = s.room.word!.id;
      s.room.players[0].vestigeLetter = 'X';
      s.closeClues();
      s.command(s.teacher, { type: 'vote:open' });
      s.command(s.teacher, { type: 'vote:close' });
      await pause();
      const next = { type: 'round:next', requestId: randomUUID() } as Command;
      s.engine.execute(s.teacher, next);
      assert.equal(s.room.word!.categoria, 'Navegadores');
      assert.notEqual(s.room.word!.id, previous);
      assert.equal((s.engine.privateState(s.room, s.players[0]) as any).vestigeLetter, null);
      if (round < total) assert.ok(!seen.has(s.room.word!.id));
      seen.add(s.room.word!.id);
      const current = s.room.word!.id;
      s.engine.execute(s.teacher, next);
      assert.equal(s.room.word!.id, current);
    }
    assert.equal(seen.size, total);
  } finally {
    s.engine.close();
  }
});
test('eliminar impostor dá vitória imediata aos civis', async () => {
  const s = setup();
  try {
    await s.start();
    await s.vote(s.players[0].playerId!);
    assert.equal(s.room.phase, 'GAME_OVER');
    assert.equal(s.room.result!.winner, 'civis');
  } finally {
    s.engine.close();
  }
});
test('um impostor e um civil encerram com vitória do impostor', async () => {
  const s = setup(3);
  try {
    await s.start();
    await s.vote(s.players[1].playerId!);
    assert.equal(s.room.phase, 'GAME_OVER');
    assert.equal(s.room.result!.winner, 'impostor');
    rejects(() => s.command(s.teacher, { type: 'vote:open' }), 'WRONG_PHASE');
  } finally {
    s.engine.close();
  }
});
test('reconexão restaura identidade e não concede segunda dica', async () => {
  const s = setup();
  try {
    await s.start();
    s.command(s.players[1], { type: 'clue:submit', text: 'Minha pista' });
    s.engine.disconnect(s.players[1], 's1');
    const restored = s.engine.resume(s.room.code, s.players[1].token!, 'new');
    assert.equal(restored.playerId, s.players[1].playerId);
    assert.equal(s.room.players.length, 4);
    rejects(
      () => s.command(restored, { type: 'clue:submit', text: 'Segunda pista' }),
      'ALREADY_SUBMITTED',
    );
  } finally {
    s.engine.close();
  }
});
test('jogador, telão e identidade forjada não executam comandos administrativos', () => {
  const s = setup();
  try {
    rejects(() => s.command(s.players[0], { type: 'game:start' }), 'FORBIDDEN');
    rejects(
      () => s.command({ kind: 'display', code: s.room.code }, { type: 'game:start' }),
      'FORBIDDEN',
    );
    rejects(
      () => s.command({ ...s.teacher, token: 'forged' }, { type: 'game:start' }),
      'FORBIDDEN',
    );
    rejects(
      () =>
        s.command(
          { ...s.players[0], playerId: s.players[1].playerId },
          { type: 'player:ready', ready: true, avatar: 0 },
        ),
      'UNAUTHORIZED',
    );
  } finally {
    s.engine.close();
  }
});
test('comando repetido não reinicia fase nem cria outro voto', async () => {
  const s = setup();
  try {
    await s.start();
    const cmd = { type: 'clues:close', requestId: randomUUID() } as Command;
    s.engine.execute(s.teacher, cmd);
    s.engine.execute(s.teacher, cmd);
    assert.equal(s.room.phase, 'WAITING_FOR_VOTE');
  } finally {
    s.engine.close();
  }
});
test('nova partida preserva participantes e apaga dados privados anteriores', async () => {
  const s = setup();
  try {
    await s.start();
    const previous = s.room.word!.id;
    await s.vote(s.players[0].playerId!);
    s.command(s.teacher, { type: 'game:reset' });
    assert.equal(s.room.phase, 'LOBBY');
    assert.equal(s.room.players.length, 4);
    assert.ok(s.room.players.every((p) => p.alive && !p.ready));
    assert.equal(s.room.history.length, 0);
    assert.equal(s.room.word, null);
    assert.equal((s.engine.privateState(s.room, s.players[0]) as any).role, null);
    await s.start();
    assert.notEqual(s.room.word!.id, previous);
  } finally {
    s.engine.close();
  }
});
test('encerramento manual não inventa vencedor', async () => {
  const s = setup();
  try {
    await s.start();
    s.command(s.teacher, { type: 'game:end' });
    assert.equal(s.room.result!.winner, 'cancelada');
  } finally {
    s.engine.close();
  }
});
test('jogadores tardios só entram como espectadores quando permitido', async () => {
  const s = setup();
  try {
    await s.start();
    rejects(() => s.engine.join(s.room.code, 'Atrasado', 1, 'late'), 'GAME_STARTED');
    s.room.settings.allowSpectators = true;
    const p = s.engine.join(s.room.code, 'Atrasado', 1, 'late');
    assert.equal((s.engine.privateState(s.room, p.auth) as any).role, 'spectator');
    rejects(() => s.command(p.auth, { type: 'clue:submit', text: 'Oi' }), 'ELIMINATED');
  } finally {
    s.engine.close();
  }
});
test('remover aluno invalida a sessão anterior', () => {
  const s = setup();
  try {
    s.command(s.teacher, { type: 'teacher:remove', playerId: s.players[0].playerId });
    rejects(() => s.engine.resume(s.room.code, s.players[0].token!, 'return'), 'SESSION_EXPIRED');
  } finally {
    s.engine.close();
  }
});
