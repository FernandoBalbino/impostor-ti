import { randomBytes, randomInt } from 'node:crypto';
import {
  CATEGORIES,
  type Category,
  type Settings,
  type PublicRoom,
  type PrivateState,
  type PublicPlayer,
  type WordCard,
  type VoteResult,
  type RoundHistory,
  type Command,
  type Session,
} from '@impostor/shared';
import { CATALOG } from './catalog.js';

export class GameError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
const fail = (code: string, message: string): never => {
  throw new GameError(code, message);
};
export const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
const token = () => randomBytes(32).toString('base64url');
type Player = PublicPlayer & { token: string; sockets: Set<string> };
export interface Auth {
  code: string;
  kind: 'teacher' | 'player' | 'display';
  playerId?: string;
  token?: string;
}
export interface Room {
  code: string;
  revision: number;
  phase: PublicRoom['phase'];
  round: number;
  settings: Settings;
  players: Player[];
  teacherToken: string;
  teacherSockets: Set<string>;
  manualImpostorId: string | null;
  impostorId: string | null;
  word: WordCard | null;
  deadline: number | null;
  timer?: ReturnType<typeof setTimeout>;
  votes: Map<string, string>;
  candidates: string[];
  runoff: boolean;
  voteResult: VoteResult | null;
  history: RoundHistory[];
  eliminations: PublicRoom['eliminations'];
  result: PublicRoom['result'];
  updated: number;
  previousWordId?: string;
  requests: Map<string, Set<string>>;
}
export interface EngineOptions {
  now?: () => number;
  revealMs?: number;
  resultMs?: number;
  onChange?: (room: Room, privateChanged: boolean) => void;
  onRemove?: (code: string, playerId: string, sockets: string[]) => void;
  onExpire?: (code: string) => void;
}

export class GameEngine {
  rooms = new Map<string, Room>();
  private now: () => number;
  private cleanup: ReturnType<typeof setInterval>;
  constructor(private options: EngineOptions = {}) {
    this.now = options.now ?? Date.now;
    this.cleanup = setInterval(() => this.sweep(), 60_000);
    this.cleanup.unref();
  }
  close() {
    clearInterval(this.cleanup);
    for (const room of this.rooms.values()) this.clearTimer(room);
  }
  room(code: string) {
    return (
      this.rooms.get(code.toUpperCase()) ??
      fail(
        'ROOM_NOT_FOUND',
        'Esta sala não existe mais. O servidor pode ter reiniciado. Peça ao professor um novo código.',
      )
    );
  }
  private touch(room: Room, privateChanged = false) {
    room.updated = this.now();
    room.revision++;
    this.options.onChange?.(room, privateChanged);
  }
  private requirePhase(room: Room, ...phases: Room['phase'][]) {
    if (!phases.includes(room.phase))
      fail('WRONG_PHASE', 'Esta ação não está disponível nesta fase.');
  }
  private clearTimer(room: Room) {
    if (room.timer) clearTimeout(room.timer);
    room.timer = undefined;
    room.deadline = null;
  }
  private schedule(room: Room, ms: number, callback: () => void) {
    this.clearTimer(room);
    room.deadline = this.now() + ms;
    room.timer = setTimeout(callback, ms);
    room.timer.unref();
  }
  private active(room: Room) {
    return room.players.filter((p) => p.alive && !p.spectator);
  }
  private player(room: Room, auth: Auth) {
    return (
      room.players.find((p) => p.id === auth.playerId && p.token === auth.token) ??
      fail('UNAUTHORIZED', 'Sua sessão não é válida.')
    );
  }
  private teacher(room: Room, auth: Auth) {
    if (auth.kind !== 'teacher' || auth.token !== room.teacherToken)
      fail('FORBIDDEN', 'Este comando é exclusivo do professor.');
  }
  private eligible(room: Room, auth: Auth) {
    if (auth.kind !== 'player') fail('FORBIDDEN', 'Somente alunos participantes podem fazer isso.');
    const p = this.player(room, auth);
    if (!p.alive || p.spectator)
      fail('ELIMINATED', 'Você está assistindo e não pode participar desta ação.');
    return p;
  }
  private uniqueName(room: Room, raw: string) {
    const name = raw
      .normalize('NFC')
      .replace(/[\p{Cc}\p{Cf}<>]/gu, '')
      .trim()
      .replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 24 || !/[\p{L}\p{N}]/u.test(name))
      fail('INVALID_NAME', 'Use um nome entre 2 e 24 caracteres.');
    if (room.players.some((p) => normalize(p.name) === normalize(name)))
      fail('DUPLICATE_NAME', 'Já existe alguém com esse nome. Acrescente seu sobrenome.');
    return name;
  }
  create(socketId: string): { auth: Auth; session: Session } {
    let code: string;
    do {
      code = Array.from(
        { length: 6 },
        () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)],
      ).join('');
    } while (this.rooms.has(code));
    const secret = token();
    const room: Room = {
      code,
      revision: 0,
      phase: 'LOBBY',
      round: 0,
      settings: {
        categories: [...CATEGORIES],
        clueSeconds: 60,
        allowSpectators: false,
        selectionMode: 'random',
      },
      players: [],
      teacherToken: secret,
      teacherSockets: new Set([socketId]),
      manualImpostorId: null,
      impostorId: null,
      word: null,
      deadline: null,
      votes: new Map(),
      candidates: [],
      runoff: false,
      voteResult: null,
      history: [],
      eliminations: [],
      result: null,
      updated: this.now(),
      requests: new Map(),
    };
    this.rooms.set(code, room);
    this.touch(room);
    return {
      auth: { code, kind: 'teacher', token: secret },
      session: { code, kind: 'teacher', token: secret },
    };
  }
  join(
    code: string,
    rawName: string,
    avatar: number,
    socketId: string,
  ): { auth: Auth; session: Session } {
    const room = this.room(code);
    const spectator = room.phase !== 'LOBBY';
    if (spectator && !room.settings.allowSpectators)
      fail('GAME_STARTED', 'A partida já começou. Aguarde a próxima partida.');
    if (room.players.filter((p) => !p.spectator).length >= 24 && !spectator)
      fail('ROOM_FULL', 'Esta sala já tem 24 alunos.');
    if (room.players.length >= 48)
      fail('ROOM_FULL', 'O limite de participantes e espectadores foi atingido.');
    const name = this.uniqueName(room, rawName);
    const p: Player = {
      id: randomBytes(12).toString('hex'),
      token: token(),
      name,
      avatar,
      online: true,
      ready: false,
      alive: !spectator,
      spectator,
      clue: null,
      voted: false,
      sockets: new Set([socketId]),
    };
    room.players.push(p);
    this.touch(room);
    return {
      auth: { code: room.code, kind: 'player', playerId: p.id, token: p.token },
      session: { code: room.code, kind: 'player', token: p.token },
    };
  }
  resume(code: string, secret: string, socketId: string): Auth {
    const room = this.room(code);
    if (secret === room.teacherToken) {
      room.teacherSockets.add(socketId);
      this.touch(room);
      return { code: room.code, kind: 'teacher', token: secret };
    }
    const p =
      room.players.find((p) => p.token === secret) ??
      fail(
        'SESSION_EXPIRED',
        'Sua sessão não é mais válida. Entre novamente ou fale com o professor.',
      );
    p.sockets.add(socketId);
    p.online = true;
    this.touch(room);
    return { code: room.code, kind: 'player', playerId: p.id, token: secret };
  }
  disconnect(auth: Auth, socketId: string) {
    const room = this.rooms.get(auth.code);
    if (!room) return;
    if (auth.kind === 'teacher') room.teacherSockets.delete(socketId);
    if (auth.kind === 'player') {
      const p = room.players.find((p) => p.id === auth.playerId);
      if (p) {
        p.sockets.delete(socketId);
        p.online = p.sockets.size > 0;
      }
    }
    if (auth.kind !== 'display') this.touch(room);
  }
  public(room: Room): PublicRoom {
    return {
      code: room.code,
      revision: room.revision,
      phase: room.phase,
      round: room.round,
      settings: structuredClone(room.settings),
      players: room.players.map(({ token: _, sockets: __, ...p }) => ({ ...p })),
      teacherOnline: room.teacherSockets.size > 0,
      deadline: room.deadline,
      category: room.word?.categoria ?? null,
      candidates: [...room.candidates],
      voteResult: room.voteResult ? structuredClone(room.voteResult) : null,
      history: structuredClone(room.history),
      eliminations: structuredClone(room.eliminations),
      result: room.result ? structuredClone(room.result) : null,
    };
  }
  privateState(room: Room, auth: Auth): PrivateState {
    if (auth.kind === 'display') return { kind: 'display' };
    if (auth.kind === 'teacher') {
      this.teacher(room, auth);
      return {
        kind: 'teacher',
        word: room.word ? { ...room.word } : null,
        impostorId: room.impostorId,
        manualImpostorId: room.manualImpostorId,
      };
    }
    const p = this.player(room, auth);
    const role = p.spectator
      ? 'spectator'
      : !room.word
        ? null
        : p.id === room.impostorId
          ? 'impostor'
          : 'civil';
    return {
      kind: 'player',
      playerId: p.id,
      role,
      word: role === 'civil' && room.word ? { ...room.word } : null,
    };
  }
  execute(auth: Auth, cmd: Command) {
    const room = this.room(auth.code);
    // Never accept a stale/forged identity merely because it has the same room code.
    if (auth.kind === 'teacher') this.teacher(room, auth);
    else if (auth.kind === 'player') this.player(room, auth);
    else fail('FORBIDDEN', 'O telão é somente para leitura.');
    const key = auth.token!;
    const seen = room.requests.get(key) ?? new Set<string>();
    if (seen.has(cmd.requestId)) return;
    switch (cmd.type) {
      case 'player:ready': {
        this.requirePhase(room, 'LOBBY');
        const p = this.player(room, auth);
        p.avatar = cmd.avatar;
        p.ready = cmd.ready;
        break;
      }
      case 'teacher:settings': {
        this.teacher(room, auth);
        this.requirePhase(room, 'LOBBY');
        room.settings = structuredClone(cmd.settings);
        room.manualImpostorId = cmd.manualImpostorId;
        this.touch(room, true);
        this.remember(room, key, seen, cmd.requestId);
        return;
      }
      case 'teacher:remove': {
        this.teacher(room, auth);
        this.requirePhase(room, 'LOBBY');
        const p =
          room.players.find((p) => p.id === cmd.playerId) ??
          fail('PLAYER_NOT_FOUND', 'Aluno não encontrado.');
        room.players = room.players.filter((x) => x.id !== p.id);
        room.requests.delete(p.token);
        if (room.manualImpostorId === p.id) room.manualImpostorId = null;
        this.options.onRemove?.(room.code, p.id, [...p.sockets]);
        break;
      }
      case 'game:start': {
        this.teacher(room, auth);
        this.requirePhase(room, 'LOBBY');
        const alive = this.active(room);
        if (alive.length < 3) fail('NOT_ENOUGH_PLAYERS', 'São necessários pelo menos 3 alunos.');
        if (alive.some((p) => !p.ready || !p.online))
          fail('NOT_READY', 'Todos os alunos precisam estar conectados e prontos.');
        if (
          room.settings.selectionMode === 'manual' &&
          !alive.some((p) => p.id === room.manualImpostorId)
        )
          fail('SELECT_IMPOSTOR', 'Escolha o impostor antes de começar.');
        room.impostorId =
          room.settings.selectionMode === 'manual'
            ? room.manualImpostorId
            : alive[randomInt(alive.length)].id;
        const pool = CATALOG.filter(
          (w) => room.settings.categories.includes(w.categoria) && w.id !== room.previousWordId,
        );
        room.word = { ...pool[randomInt(pool.length)] };
        room.previousWordId = room.word.id;
        room.round = 1;
        room.phase = 'ROLE_REVEAL';
        this.schedule(room, this.options.revealMs ?? 6000, () => {
          if (room.phase !== 'ROLE_REVEAL') return;
          this.startClues(room);
          this.touch(room);
        });
        this.touch(room, true);
        this.remember(room, key, seen, cmd.requestId);
        return;
      }
      case 'clue:submit': {
        this.requirePhase(room, 'CLUES');
        if (room.deadline !== null && this.now() >= room.deadline) {
          this.endClues(room);
          this.touch(room);
          fail('TIME_UP', 'O tempo para enviar dicas terminou.');
        }
        const p = this.eligible(room, auth);
        if (p.clue !== null) fail('ALREADY_SUBMITTED', 'Você já enviou sua dica nesta rodada.');
        const text = cmd.text
          .normalize('NFC')
          .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
          .trim()
          .replace(/\s+/g, ' ');
        if (!text || Array.from(text).length > 80)
          fail('INVALID_CLUE', 'Escreva uma dica com até 80 caracteres.');
        const normalized = ` ${normalize(text)} `;
        if (p.id !== room.impostorId && normalized.includes(` ${normalize(room.word!.nome)} `))
          fail('WORD_IN_CLUE', 'Dê uma pista sem escrever a palavra secreta.');
        p.clue = text;
        if (this.active(room).every((p) => p.clue !== null)) this.endClues(room);
        break;
      }
      case 'clues:close':
        this.teacher(room, auth);
        this.requirePhase(room, 'CLUES');
        this.endClues(room);
        break;
      case 'vote:open': {
        this.teacher(room, auth);
        this.requirePhase(room, 'WAITING_FOR_VOTE', 'TIEBREAK');
        room.runoff = room.phase === 'TIEBREAK';
        room.phase = 'VOTING';
        room.votes.clear();
        room.players.forEach((p) => (p.voted = false));
        room.voteResult = null;
        break;
      }
      case 'vote:submit': {
        this.requirePhase(room, 'VOTING');
        const p = this.eligible(room, auth);
        if (room.votes.has(p.id)) fail('ALREADY_VOTED', 'Seu voto já foi confirmado.');
        if (cmd.targetId === p.id) fail('SELF_VOTE', 'Você não pode votar em si mesmo.');
        if (
          !this.active(room).some((p) => p.id === cmd.targetId) ||
          (room.runoff && !room.candidates.includes(cmd.targetId))
        )
          fail('INVALID_TARGET', 'Escolha um suspeito elegível.');
        room.votes.set(p.id, cmd.targetId);
        p.voted = true;
        break;
      }
      case 'vote:close':
        this.teacher(room, auth);
        this.requirePhase(room, 'VOTING');
        this.closeVote(room);
        this.remember(room, key, seen, cmd.requestId);
        return;
      case 'round:next':
        this.teacher(room, auth);
        this.requirePhase(room, 'WAITING_FOR_NEXT_ROUND');
        room.round++;
        this.startClues(room);
        break;
      case 'game:end':
        this.teacher(room, auth);
        if (room.phase === 'LOBBY' || room.phase === 'GAME_OVER')
          fail('WRONG_PHASE', 'Não há partida em andamento.');
        this.finish(room, 'cancelada');
        break;
      case 'game:reset': {
        this.teacher(room, auth);
        this.requirePhase(room, 'GAME_OVER');
        this.clearTimer(room);
        room.phase = 'LOBBY';
        room.round = 0;
        room.result = null;
        room.impostorId = null;
        room.word = null;
        let seats = room.players.filter((p) => !p.spectator).length;
        room.players.forEach((p) => {
          if (p.spectator && p.online && seats < 24) {
            p.spectator = false;
            seats++;
          }
          p.alive = !p.spectator;
          p.ready = false;
          p.clue = null;
          p.voted = false;
        });
        room.votes.clear();
        room.candidates = [];
        room.voteResult = null;
        room.history = [];
        room.eliminations = [];
        room.runoff = false;
        this.touch(room, true);
        this.remember(room, key, seen, cmd.requestId);
        return;
      }
      case 'session:leave': {
        if (auth.kind === 'player' && room.phase === 'LOBBY') {
          const p = this.player(room, auth);
          room.players = room.players.filter((x) => x.id !== p.id);
          room.requests.delete(p.token);
          this.options.onRemove?.(room.code, p.id, [...p.sockets]);
        } else
          fail('LEAVE_REQUIRES_DISCONNECT', 'Sua vaga será preservada enquanto a partida existir.');
        break;
      }
      default:
        fail('INVALID_COMMAND', 'Comando inválido.');
    }
    this.remember(room, key, seen, cmd.requestId);
    this.touch(room);
  }
  private remember(room: Room, key: string, seen: Set<string>, requestId: string) {
    seen.add(requestId);
    if (seen.size > 500) seen.delete(seen.values().next().value!);
    room.requests.set(key, seen);
  }
  private startClues(room: Room) {
    room.phase = 'CLUES';
    room.candidates = [];
    room.voteResult = null;
    room.runoff = false;
    room.votes.clear();
    room.players.forEach((p) => {
      p.clue = null;
      p.voted = false;
    });
    room.history.push({ round: room.round, clues: [], votes: [] });
    this.schedule(room, room.settings.clueSeconds * 1000, () => {
      if (room.phase === 'CLUES') {
        this.endClues(room);
        this.touch(room);
      }
    });
  }
  private endClues(room: Room) {
    this.clearTimer(room);
    room.phase = 'WAITING_FOR_VOTE';
    const history = room.history.at(-1)!;
    history.clues = this.active(room).map((p) => ({
      playerId: p.id,
      name: p.name,
      text: p.clue ?? 'Sem dica',
    }));
  }
  private closeVote(room: Room) {
    const counts: Record<string, number> = {};
    for (const id of room.votes.values()) counts[id] = (counts[id] ?? 0) + 1;
    const max = Math.max(0, ...Object.values(counts));
    const tied = Object.keys(counts).filter((id) => counts[id] === max);
    const result: VoteResult = {
      counts,
      tied: tied.length > 1 ? tied : [],
      eliminatedId: tied.length === 1 ? tied[0] : null,
      runoff: room.runoff,
      noVotes: max === 0,
    };
    room.voteResult = result;
    room.history.at(-1)!.votes.push(structuredClone(result));
    room.phase = 'VOTE_RESULTS';
    this.schedule(room, this.options.resultMs ?? 2800, () => {
      if (result.eliminatedId) {
        const p = room.players.find((p) => p.id === result.eliminatedId)!;
        p.alive = false;
        room.eliminations.push({ playerId: p.id, name: p.name, round: room.round });
        room.phase = 'ELIMINATION';
        if (p.id === room.impostorId) this.finish(room, 'civis');
        else if (this.active(room).length === 2) this.finish(room, 'impostor');
        else
          this.schedule(room, this.options.resultMs ?? 2800, () => {
            room.phase = 'WAITING_FOR_NEXT_ROUND';
            this.clearTimer(room);
            this.touch(room);
          });
      } else if (result.tied.length > 1 && !room.runoff) {
        this.clearTimer(room);
        room.candidates = [...result.tied];
        room.phase = 'TIEBREAK';
      } else {
        this.clearTimer(room);
        room.candidates = [];
        room.phase = 'WAITING_FOR_NEXT_ROUND';
      }
      this.touch(room);
    });
    this.touch(room);
  }
  private finish(room: Room, winner: 'civis' | 'impostor' | 'cancelada') {
    this.clearTimer(room);
    room.phase = 'GAME_OVER';
    room.result = { winner, impostorId: room.impostorId!, word: { ...room.word! } };
  }
  private sweep() {
    for (const [code, room] of this.rooms) {
      const connected = room.teacherSockets.size > 0 || room.players.some((p) => p.online);
      if (!connected && this.now() - room.updated > 30 * 60_000) {
        this.clearTimer(room);
        this.rooms.delete(code);
        this.options.onExpire?.(code);
      }
    }
  }
}
