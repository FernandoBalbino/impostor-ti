import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PublicPlayer, VoteResult } from '@impostor/shared';
import { voteRanking } from '../apps/web/src/vote-results.js';

const players: PublicPlayer[] = Array.from({ length: 24 }, (_, i) => ({
  id: `p${i}`,
  name: `Aluno ${i}`,
  avatar: i,
  online: true,
  ready: false,
  alive: true,
  spectator: false,
  clue: 'Dica',
  voted: true,
}));
const result = (counts: Record<string, number>): VoteResult => ({
  counts,
  tied: [],
  eliminatedId: null,
  protectedId: null,
  noVotes: false,
  runoff: false,
});

test('ranking exclui zero votos, ordena contagem ponderada e mantém proporção e velocidade das barras', () => {
  const data = result({ p0: 0, p1: 2, p2: 12, p3: 6 });
  const original = structuredClone(data);
  const rows = voteRanking(players, data);
  assert.deepEqual(
    rows.map((r) => r.player.id),
    ['p2', 'p3', 'p1'],
  );
  assert.deepEqual(
    rows.map((r) => r.fraction),
    [1, 0.5, 1 / 6],
  );
  assert.deepEqual(
    rows.map((r) => r.durationMs),
    [1800, 900, 300],
  );
  assert.deepEqual(
    rows.map((r) => r.leader),
    [true, false, false],
  );
  assert.deepEqual(data, original, 'Apresentação não modifica o resultado do servidor');
});

test('empatados têm a mesma posição, destaque, largura e duração; lista com 24 votados é preservada', () => {
  const rows = voteRanking(players, result({ p0: 12, p1: 12, p2: 3, p3: 3 }));
  assert.deepEqual(
    rows.map((r) => r.rank),
    [1, 1, 3, 3],
  );
  assert.deepEqual(
    rows.map((r) => r.tied),
    [true, true, true, true],
  );
  assert.deepEqual(
    rows.map((r) => r.leader),
    [true, true, false, false],
  );
  assert.deepEqual(
    rows.slice(0, 2).map((r) => r.durationMs),
    [1800, 1800],
  );
  assert.equal(
    voteRanking(players, result(Object.fromEntries(players.map((p) => [p.id, 1])))).length,
    24,
  );
});

test('sem votos não cria jogadores, barras ou proporções inválidas', () => {
  assert.deepEqual(voteRanking(players, result({})), []);
  assert.deepEqual(voteRanking(players, result({ p0: 0 })), []);
});
