export const CATEGORIES = [
  'Hardware',
  'Software',
  'Navegadores',
  'Sistemas operacionais',
  'Conceitos básicos',
] as const;
export type Category = (typeof CATEGORIES)[number];
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
  category: Category | null;
  candidates: string[];
  voteResult: VoteResult | null;
  history: RoundHistory[];
  eliminations: { playerId: string; name: string; round: number }[];
  result: { winner: Winner; impostorId: string; word: WordCard } | null;
}
export type PrivateState =
  | {
      kind: 'teacher';
      word: WordCard | null;
      impostorId: string | null;
      manualImpostorId: string | null;
    }
  | {
      kind: 'player';
      playerId: string;
      role: 'civil' | 'impostor' | 'spectator' | null;
      word: WordCard | null;
    }
  | { kind: 'display' };
export interface Session {
  code: string;
  token: string;
  kind: 'teacher' | 'player';
}
export interface Snapshot {
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
export type Command =
  | { type: 'room:create'; requestId: string }
  | { type: 'room:join'; code: string; name: string; avatar: number; requestId: string }
  | { type: 'session:resume'; code: string; token: string; requestId: string }
  | { type: 'display:join'; code: string; requestId: string }
  | { type: 'player:ready'; ready: boolean; avatar: number; requestId: string }
  | {
      type: 'teacher:settings';
      settings: Settings;
      manualImpostorId: string | null;
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
export type Ack =
  | { ok: true; session?: Session; snapshot?: Snapshot }
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
