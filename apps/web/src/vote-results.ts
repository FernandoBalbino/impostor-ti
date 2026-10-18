import type { PublicPlayer, VoteResult } from '@impostor/shared';

export function voteRanking(players: PublicPlayer[], result: VoteResult) {
  const voted = players
    .map((player, order) => ({ player, count: result.counts[player.id] ?? 0, order }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count || a.order - b.order);
  const max = voted[0]?.count ?? 0;
  return voted.map(({ player, count }, index) => ({
    player,
    count,
    rank: voted.findIndex((entry) => entry.count === count) + 1,
    tied: voted.some((entry, other) => other !== index && entry.count === count),
    leader: count === max,
    fraction: count / max,
    // Same speed for every bar: more votes take longer, bounded by the existing result phase.
    durationMs: Math.round((1800 * count) / max),
  }));
}
