import {
  POWER_IDS,
  POWERS,
  type PowerId,
  type PowerSlot,
  type PowerNotice,
  type PublicRoom,
} from '@impostor/shared';
import type { Room, Player } from './engine.js';

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const words = [
  'lua',
  'sol',
  'mar',
  'vento',
  'flor',
  'ponte',
  'pedra',
  'nuvem',
  'jardim',
  'livro',
  'chuva',
  'estrela',
  'bosque',
  'farol',
  'rio',
  'trilho',
  'castelo',
  'barco',
  'montanha',
  'pipa',
  'tigre',
  'sino',
  'neve',
  'pato',
  'lago',
  'vila',
  'trem',
  'copo',
  'céu',
  'praia',
];
const phrases = [
  'O mistério deu uma volta completa.',
  'Essa pista veio de outro universo.',
  'O silêncio também tem suas teorias.',
  'Nem toda certeza encontra uma resposta.',
  'O destino resolveu embaralhar as pistas.',
  'Uma pergunta se esconde nesta frase.',
  'Até as sombras podem se confundir.',
  'A resposta ficou pelo caminho.',
];
export const roundLive = (room: Room) =>
  !['LOBBY', 'WAITING_FOR_NEXT_ROUND', 'GAME_OVER'].includes(room.phase);
const chaosLive = (r: Room) =>
  roundLive(r) && ['VOTING', 'VOTE_RESULTS', 'TIEBREAK', 'ELIMINATION'].includes(r.phase);
const alive = (r: Room) => r.players.filter((p) => p.alive && !p.spectator);

export function projectRoom(room: Room, base: PublicRoom, viewerId?: string): PublicRoom {
  const viewer = room.players.find((p) => p.id === viewerId);
  const blind = !!viewer && viewer.effects.blindRound === room.round && roundLive(room);
  const confused =
    viewer?.effects.confusion?.round === room.round && room.phase === 'VOTING'
      ? viewer.effects.confusion.order
      : null;
  const swaps = roundLive(room) ? room.swaps.filter((s) => s.round === room.round) : [];
  const chaos = chaosLive(room) && room.players.some((p) => p.effects.chaos?.round === room.round);
  if (!blind && !confused && !swaps.length && !chaos) return base;
  const names = new Map(room.players.map((p) => [p.id, p.name]));
  for (const s of swaps) {
    const a = names.get(s.a),
      b = names.get(s.b);
    if (a && b) {
      names.set(s.a, b);
      names.set(s.b, a);
    }
  }
  if (confused) {
    const ids = room.players.filter((p) => confused.includes(p.id)).map((p) => p.id);
    const ordered = confused.filter((id) => ids.includes(id));
    const before = new Map(names);
    ids.forEach((id, i) => names.set(id, before.get(ordered[i])!));
  }
  const clue = (id: string, original: string | null) => {
    if (blind && id !== viewerId) return null;
    const p = room.players.find((p) => p.id === id);
    return chaosLive(room) && p?.effects.chaos?.round === room.round
      ? p.effects.chaos.text
      : original;
  };
  return {
    ...base,
    players: base.players.map((p) => ({
      ...p,
      name: names.get(p.id) ?? p.name,
      clue: clue(p.id, p.clue),
    })),
    history: base.history.map((h) => ({
      ...h,
      clues: h.clues
        .filter((c) => !blind || c.playerId === viewerId)
        .map((c) => ({
          ...c,
          name: names.get(c.playerId) ?? c.name,
          text: h.round === room.round ? (clue(c.playerId, c.text) ?? 'Dica oculta') : c.text,
        })),
    })),
    eliminations: base.eliminations.map((e) => ({ ...e, name: names.get(e.playerId) ?? e.name })),
  };
}

export function finishEffects(room: Room) {
  room.swaps = room.swaps.filter((s) => s.round > room.round);
  for (const p of room.players) {
    if (p.effects.chaos?.round === room.round) p.effects.chaos = null;
    if (p.effects.confusion?.round === room.round) p.effects.confusion = null;
    if (p.effects.blindRound === room.round) p.effects.blindRound = 0;
  }
}
export function transformPowers(
  room: Room,
  random: (n: number) => number,
  notify: (p: Player, id: PowerId, message: string) => void,
) {
  for (const p of room.players)
    for (const slot of p.powers) {
      if (slot.pendingRound && slot.pendingRound <= room.round) {
        const pool = POWER_IDS.filter(
          (id) => id !== 'pandora' && !p.powers.some((s) => s !== slot && s.id === id),
        );
        slot.id = pool[random(pool.length)];
        slot.cooldown = 2;
        slot.readyRound = room.round;
        slot.used = false;
        delete slot.pendingRound;
        notify(p, slot.id, 'Você recebeu ' + POWERS[slot.id].name + '. Recarga: duas rodadas.');
      }
    }
}
type Helpers = {
  now: number;
  random: (n: number) => number;
  fail: (code: string, message: string) => never;
  notice: (
    p: Player,
    id: PowerId,
    title: string,
    message: string,
    tone: PowerNotice['tone'],
  ) => PowerNotice;
};
function cures(room: Room, p: Player, now: number): { name: string; remove: () => void }[] {
  const e = p.effects;
  const list: { name: string; remove: () => void }[] = [];
  const add = (test: unknown, name: string, remove: () => void) => {
    if (test) list.push({ name, remove });
  };
  add(e.silencedUntil > now, 'Silêncio do Inocente', () => {
    e.silencedUntil = 0;
  });
  add(e.forbiddenLetter, 'Letra do Abismo', () => {
    e.forbiddenLetter = null;
  });
  add(e.bannedVoteRound === room.round, 'Exílio do Veredito', () => {
    e.bannedVoteRound = 0;
  });
  add(p.fakeClue !== null, 'Eco Apócrifo', () => {
    p.fakeClue = null;
  });
  add(
    e.hiddenImageRounds.some((r) => r >= room.round),
    'Véu de Platão',
    () => {
      e.hiddenImageRounds = [];
    },
  );
  add(e.labyrinthWords.length, 'Labirinto das Palavras', () => {
    e.labyrinthWords = [];
  });
  add(e.dice?.round === room.round, 'Dado de Dionísio', () => {
    e.dice = null;
  });
  add(e.blindRound >= room.round && e.blindRound > 0, 'Olho do Vazio', () => {
    e.blindRound = 0;
  });
  add(e.confusion?.round === room.round, 'Confusão', () => {
    e.confusion = null;
  });
  add(e.chaos?.round === room.round, 'Tudo ou Nada', () => {
    e.chaos = null;
  });
  const swap = room.swaps.find((s) => s.round >= room.round && (s.a === p.id || s.b === p.id));
  add(swap, 'Close Falso', () => {
    room.swaps = room.swaps.filter((s) => s !== swap);
  });
  for (const slot of p.powers)
    add(
      (slot.blockedUntilRound ?? 0) >= room.round && !!slot.blockedUntilRound,
      'Mão Divina',
      () => {
        delete slot.blockedUntilRound;
      },
    );
  return list;
}
export function prepareNewPower(
  room: Room,
  actor: Player,
  to: Player,
  id: PowerId,
  slot: PowerSlot,
  h: Helpers,
) {
  const e = to.effects;
  const duplicate = () =>
    h.fail('EFFECT_ACTIVE', 'Esse efeito já está ativo ou agendado. Seu poder não foi gasto.');
  const changed = [actor.id, to.id];
  const activeClue = room.phase === 'CLUES' && h.now < (room.clueDeadline ?? 0);
  let apply: (() => { message: string; targetMessage?: string }) | undefined;
  switch (id) {
    case 'labyrinth': {
      if (e.labyrinthWords.length) duplicate();
      const pool = words.filter(
        (w) =>
          (!e.forbiddenLetter || !fold(w).includes(e.forbiddenLetter.toLowerCase())) &&
          !fold(room.word?.nome ?? '').includes(fold(w)),
      );
      if (pool.length < 3)
        h.fail('NO_WORDS', 'Não há palavras compatíveis. Seu poder não foi gasto.');
      apply = () => {
        const choices = [...pool];
        e.labyrinthWords = [];
        for (let i = 0; i < 3; i++)
          e.labyrinthWords.push(choices.splice(h.random(choices.length), 1)[0]);
        return {
          message: 'O alvo recebeu três palavras para sua próxima dica.',
          targetMessage:
            'Sua próxima dica verdadeira deve incluir uma destas palavras: ' +
            e.labyrinthWords.join(', ') +
            '.',
        };
      };
      break;
    }
    case 'dice':
      if (e.dice?.round === room.round) duplicate();
      if (e.bannedVoteRound === room.round)
        h.fail('VOTE_BANNED', 'Esse jogador não pode votar nesta rodada.');
      if (room.phase === 'VOTING' && to.voted)
        h.fail('ALREADY_VOTED', 'Esse jogador já confirmou sua resposta.');
      apply = () => {
        e.dice = { round: room.round, value: h.random(4) };
        return {
          message: 'O peso sorteado para o alvo é ' + e.dice.value + '.',
          targetMessage:
            'Seu voto recebeu peso ' +
            e.dice.value +
            ' nesta rodada. Peso da Verdade multiplica esse valor por dois.',
        };
      };
      break;
    case 'pandora':
      if (slot.pendingRound) duplicate();
      apply = () => {
        slot.pendingRound = room.round + 1;
        return { message: 'Sua Caixa de Pandora será transformada na próxima rodada.' };
      };
      break;
    case 'name_swap':
      if (
        room.swaps.some(
          (s) => s.round >= room.round && [s.a, s.b].some((id) => id === actor.id || id === to.id),
        )
      )
        duplicate();
      apply = () => {
        room.swaps.push({ a: actor.id, b: to.id, round: room.round + 1 });
        return {
          message: 'A troca de nomes foi agendada para a próxima rodada.',
          targetMessage:
            'Na próxima rodada seu nome será trocado com o de outro jogador. Seu avatar e sua identidade permanecem.',
        };
      };
      break;
    case 'all_or_nothing': {
      if (!activeClue && room.phase !== 'WAITING_FOR_VOTE')
        h.fail(
          'POWER_WINDOW',
          'Agende durante o prazo normal das dicas ou na conversa, antes da primeira votação.',
        );
      if (actor.effects.chaos?.round === room.round) duplicate();
      const pool = alive(room).filter((p) => p !== actor && p.effects.chaos?.round !== room.round);
      if (pool.length < 2)
        h.fail('INVALID_TARGET', 'São necessários dois outros jogadores sem esse efeito.');
      changed.push(...pool.map((p) => p.id));
      apply = () => {
        const choices = [...pool];
        const targets = [
          actor,
          choices.splice(h.random(choices.length), 1)[0],
          choices.splice(h.random(choices.length), 1)[0],
        ];
        for (const p of targets) {
          if (p !== actor && p.effects.refuge) {
            p.effects.refuge = false;
            h.notice(
              p,
              'refuge',
              'Sua barreira protegeu você',
              'Refúgio Estoico absorveu Tudo ou Nada.',
              'success',
            );
            continue;
          }
          const safe = phrases.filter((text) => !fold(text).includes(fold(room.word!.nome)));
          p.effects.chaos = { round: room.round, text: safe[h.random(safe.length)] };
          if (p !== actor)
            h.notice(
              p,
              id,
              'Você foi alvo de Tudo ou Nada',
              'Sua dica será substituída por uma frase na votação desta rodada.',
              'danger',
            );
        }
        return {
          message:
            'Tudo ou Nada foi agendado para a votação. Proteções individuais são respeitadas.',
        };
      };
      break;
    }
    case 'void_eye':
      if (e.blindRound >= room.round && e.blindRound > 0) duplicate();
      apply = () => {
        e.blindRound = room.round + 1;
        return {
          message: 'O alvo ficará sem as dicas dos outros na próxima rodada.',
          targetMessage:
            'Na próxima rodada você não verá as dicas dos outros, inclusive no histórico. Sua própria dica permanece.',
        };
      };
      break;
    case 'divine_hand': {
      if (to.powers.some((s) => (s.blockedUntilRound ?? 0) >= room.round && !!s.blockedUntilRound))
        duplicate();
      const pool = to.powers.filter((s) => !(POWERS[s.id].once && s.used));
      if (!pool.length)
        h.fail('INVALID_TARGET', 'Esse jogador não possui poder elegível para suspender.');
      apply = () => {
        const selected = pool[h.random(pool.length)];
        selected.blockedUntilRound = room.round + 1;
        return {
          message: 'Um poder comum do alvo foi suspenso nesta rodada e na próxima.',
          targetMessage:
            POWERS[selected.id].name +
            ' foi suspenso nesta rodada e na próxima. Sua recarga continua normalmente.',
        };
      };
      break;
    }
    case 'chosen':
      if (room.phase === 'VOTING')
        h.fail(
          'POWER_WINDOW',
          'Ative antes de abrir a votação ou durante a preparação do desempate.',
        );
      if (e.chosenRound === room.round) duplicate();
      apply = () => {
        e.chosenRound = room.round;
        return {
          message: 'O jogador protegido não pode receber votos nesta rodada.',
          targetMessage: 'Você não pode receber votos nesta rodada, incluindo desempates.',
        };
      };
      break;
    case 'confusion':
      if (e.confusion?.round === room.round) duplicate();
      apply = () => {
        const ids = room.players.map((p) => p.id),
          offset = 1 + h.random(Math.max(1, ids.length - 1));
        e.confusion = {
          round: room.round,
          order: ids.map((_, i) => ids[(i + offset) % ids.length]),
        };
        return {
          message: 'O alvo verá os nomes embaralhados durante as votações desta rodada.',
          targetMessage:
            'Durante as votações desta rodada os nomes aparecerão trocados somente para você. Identifique os jogadores pelos avatares.',
        };
      };
      break;
    case 'prometheus': {
      const pool = cures(room, to, h.now);
      if (!pool.length)
        h.fail('NO_PENALTY', 'Esse jogador não possui um efeito hostil para remover.');
      apply = () => {
        const effect = pool[h.random(pool.length)];
        effect.remove();
        return {
          message: 'Fogo de Prometeu removeu ' + effect.name + '.',
          targetMessage:
            'Fogo de Prometeu removeu ' +
            effect.name +
            '. Votos já confirmados e recargas permanecem.',
        };
      };
      break;
    }
    default:
      return null;
  }
  return { apply: apply!, changed };
}
