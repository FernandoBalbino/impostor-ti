export const CATEGORIES = [
  'Hardware',
  'Software',
  'Navegadores',
  'Sistemas operacionais',
  'Conceitos básicos',
] as const;
export type Category = (typeof CATEGORIES)[number];
export const PROTOCOL_VERSION = 2 as const;
export const POWER_IDS = [
  'silence',
  'letter',
  'aegis',
  'double_vote',
  'ban_vote',
  'oracle',
  'echo',
  'refuge',
  'erase',
  'veil',
] as const;
export type PowerId = (typeof POWER_IDS)[number];
export const POWERS: Record<
  PowerId,
  {
    name: string;
    description: string;
    target: 'other' | 'self' | 'any';
    window: 'clues' | 'active';
    once?: boolean;
  }
> = {
  silence: {
    name: 'Silêncio do Inocente',
    description: 'Impede outro jogador de escrever e enviar uma dica por 20 segundos.',
    target: 'other',
    window: 'clues',
  },
  letter: {
    name: 'Letra do Abismo',
    description:
      'Proíbe uma letra sorteada na próxima dica verdadeira de outro jogador. Letras acentuadas também contam.',
    target: 'other',
    window: 'clues',
  },
  aegis: {
    name: 'Égide do Destino',
    description:
      'Protege você ou um colega da próxima eliminação. O escudo quebra e ninguém é eliminado. Uso único por partida.',
    target: 'any',
    window: 'active',
    once: true,
  },
  double_vote: {
    name: 'Peso da Verdade',
    description:
      'Seu voto vale por dois nesta rodada, incluindo o desempate. Ative antes de confirmar seu voto.',
    target: 'self',
    window: 'active',
  },
  ban_vote: {
    name: 'Exílio do Veredito',
    description:
      'Impede outro jogador de votar nesta rodada, incluindo o desempate. Não apaga votos já confirmados.',
    target: 'other',
    window: 'active',
  },
  oracle: {
    name: 'Oráculo da Dúvida',
    description:
      'Tem 50% de chance de revelar em segredo se outro jogador é civil ou impostor. Uma falha também gasta o poder.',
    target: 'other',
    window: 'active',
  },
  echo: {
    name: 'Eco Apócrifo',
    description:
      'Escreve uma dica falsa no nome de quem ainda não respondeu. A dica verdadeira substitui a falsa.',
    target: 'other',
    window: 'clues',
  },
  refuge: {
    name: 'Refúgio Estoico',
    description:
      'Protege você do próximo poder hostil recebido. A barreira permanece até absorver um ataque.',
    target: 'self',
    window: 'active',
  },
  erase: {
    name: 'Tábula Rasa',
    description:
      'Apaga uma dica verdadeira. O alvo recebe 20 segundos para escrever outra, mesmo após o prazo geral.',
    target: 'other',
    window: 'clues',
  },
  veil: {
    name: 'Véu de Platão',
    description:
      'Esconde a imagem do item de outro jogador na próxima rodada. O nome da palavra continua visível.',
    target: 'other',
    window: 'active',
  },
};
export const ACTIVE_POWER_PHASES: Phase[] = ['CLUES', 'WAITING_FOR_VOTE', 'VOTING', 'TIEBREAK'];
export interface PlayerEffects {
  silencedUntil: number;
  forbiddenLetter: string | null;
  aegis: boolean;
  refuge: boolean;
  doubleVoteRound: number;
  bannedVoteRound: number;
  hiddenImageRounds: number[];
}
export interface PowerSlot {
  id: PowerId;
  readyRound: number;
  used: boolean;
}
export interface PowerNotice {
  id: number;
  powerId: PowerId;
  title: string;
  message: string;
  tone: 'success' | 'danger' | 'info';
  round: number;
}
export type Phase =
  | 'LOBBY'
  | 'ROLE_REVEAL'
  | 'CLUES'
  | 'WAITING_FOR_VOTE'
  | 'VOTING'
  | 'VOTE_RESULTS'
  | 'TIEBREAK'
  | 'ELIMINATION'
  | 'WAITING_FOR_NEXT_ROUND'
  | 'GAME_OVER';
export type Winner = 'civis' | 'impostor' | 'cancelada';
export interface WordCard {
  id: string;
  nome: string;
  categoria: Category;
  imagem: string;
  dificuldade: 'facil' | 'medio';
}
export interface Settings {
  categories: Category[];
  clueSeconds: number;
  allowSpectators: boolean;
  selectionMode: 'random' | 'manual';
  impostorCount: 1 | 2 | 3;
}
export interface PublicPlayer {
  id: string;
  name: string;
  avatar: number;
  online: boolean;
  ready: boolean;
  alive: boolean;
  spectator: boolean;
  clue: string | null;
  voted: boolean;
}
export interface VoteResult {
  counts: Record<string, number>;
  tied: string[];
  eliminatedId: string | null;
  runoff: boolean;
  noVotes: boolean;
  protectedId: string | null;
}
export interface RoundHistory {
  round: number;
  clues: { playerId: string; name: string; text: string }[];
  votes: VoteResult[];
}
export interface PublicRoom {
  code: string;
  revision: number;
  phase: Phase;
  round: number;
  players: PublicPlayer[];
  settings: Settings;
  teacherOnline: boolean;
  deadline: number | null;
  clueDeadline: number | null;
  clueCount: number;
  eligibleVoters: number;
  category: Category | null;
  candidates: string[];
  voteResult: VoteResult | null;
  history: RoundHistory[];
  eliminations: { playerId: string; name: string; round: number }[];
  result: { winner: Winner; impostorIds: string[]; word: WordCard } | null;
}
export type PrivateState =
  | {
      kind: 'teacher';
      word: WordCard | null;
      impostorIds: string[];
      manualImpostorIds: string[];
    }
  | {
      kind: 'player';
      playerId: string;
      role: 'civil' | 'impostor' | 'spectator' | null;
      word: WordCard | null;
      impostorIds: string[];
      powers: PowerSlot[];
      usedPowerRound: number;
      effects: PlayerEffects;
      clueSubmitted: boolean;
      clueDeadline: number | null;
      notifications: PowerNotice[];
    }
  | { kind: 'display' };
export interface Session {
  code: string;
  token: string;
  kind: 'teacher' | 'player';
}
export interface Snapshot {
  protocolVersion: typeof PROTOCOL_VERSION;
  room: PublicRoom;
  privateState: PrivateState;
  serverTime: number;
}
export interface RoomUpdate {
  code: string;
  revision: number;
  changes: Partial<PublicRoom>;
  serverTime: number;
}
export type CommandInput =
  | { type: 'room:create'; requestId: string }
  | { type: 'room:join'; code: string; name: string; avatar: number; requestId: string }
  | { type: 'session:resume'; code: string; token: string; requestId: string }
  | { type: 'display:join'; code: string; requestId: string }
  | { type: 'player:ready'; ready: boolean; avatar: number; requestId: string }
  | {
      type: 'teacher:settings';
      settings: Settings;
      manualImpostorIds: string[];
      requestId: string;
    }
  | { type: 'teacher:remove'; playerId: string; requestId: string }
  | {
      type:
        | 'game:start'
        | 'clues:close'
        | 'vote:open'
        | 'vote:close'
        | 'round:next'
        | 'game:end'
        | 'game:reset'
        | 'session:leave';
      requestId: string;
    }
  | { type: 'clue:submit'; text: string; requestId: string }
  | { type: 'vote:submit'; targetId: string; requestId: string };
export type Command = (
  | CommandInput
  | { type: 'player:powers'; powers: PowerId[]; requestId: string }
  | {
      type: 'power:activate';
      powerId: PowerId;
      targetId?: string;
      text?: string;
      requestId: string;
    }
) & { protocolVersion: typeof PROTOCOL_VERSION };
export type Ack =
  | { ok: true; session?: Session; snapshot?: Snapshot; activation?: PowerNotice }
  | { ok: false; code: string; message: string };
export interface ClientEvents {
  command: (command: Command, ack: (result: Ack) => void) => void;
}
export interface ServerEvents {
  snapshot: (snapshot: Snapshot) => void;
  update: (update: RoomUpdate) => void;
  privateState: (state: PrivateState) => void;
  removed: (message: string) => void;
}
export const PHASE_LABELS: Record<Phase, string> = {
  LOBBY: 'Sala de espera',
  ROLE_REVEAL: 'Seu papel',
  CLUES: 'Dicas',
  WAITING_FOR_VOTE: 'Vamos conversar',
  VOTING: 'Votação',
  VOTE_RESULTS: 'Resultado dos votos',
  TIEBREAK: 'Desempate',
  ELIMINATION: 'Eliminação',
  WAITING_FOR_NEXT_ROUND: 'Próxima rodada',
  GAME_OVER: 'Fim de jogo',
};
