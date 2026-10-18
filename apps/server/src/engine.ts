import { randomBytes, randomInt } from 'node:crypto';
import {
  CATEGORIES,
  POWER_IDS,
  LOADOUT_SIZE,
  IMPOSTOR_POWER_ID,
  POWERS,
  ACTIVE_POWER_PHASES,
  type PowerId,
  type PowerSlot,
  type PlayerEffects,
  type PowerNotice,
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
import {
  prepareNewPower,
  projectRoom,
  roundLive,
  finishEffects,
  transformPowers,
} from './power-effects.js';
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
export type Player = PublicPlayer & {
  token: string;
  sockets: Set<string>;
  powers: PowerSlot[];
  exclusivePower: PowerSlot | null;
  vestigeLetter: string | null;
  effects: PlayerEffects;
  usedPowerRound: number;
  fakeClue: string | null;
  rewriteUntil: number;
  notifications: PowerNotice[];
  noticeSequence: number;
  originalPowers: PowerId[];
};
const freshEffects = (): PlayerEffects => ({
  silencedUntil: 0,
  forbiddenLetter: null,
  aegis: false,
  refuge: false,
  doubleVoteRound: 0,
  bannedVoteRound: 0,
  hiddenImageRounds: [],
  labyrinthWords: [],
  dice: null,
  blindRound: 0,
  chosenRound: 0,
  confusion: null,
  chaos: null,
});
type CommandResult = { activation?: PowerNotice };
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
  manualImpostorIds: string[];
  impostorIds: string[];
  word: WordCard | null;
  deadline: number | null;
  clueDeadline: number | null;
  timer?: ReturnType<typeof setTimeout>;
  votes: Map<string, { targetId: string | null; weight: number }>;
  ballotId: string | null;
  swaps: { a: string; b: string; round: number }[];
  candidates: string[];
  runoff: boolean;
  voteResult: VoteResult | null;
  history: RoundHistory[];
  eliminations: PublicRoom['eliminations'];
  result: PublicRoom['result'];
  updated: number;
  previousWordId?: string;
  requests: Map<string, Map<string, CommandResult>>;
}
export interface EngineOptions {
  now?: () => number;
  revealMs?: number;
  resultMs?: number;
  effectMs?: number;
  random?: (max: number) => number;
  onChange?: (room: Room, privateChanged: boolean | string[]) => void;
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
  private touch(room: Room, privateChanged: boolean | string[] = false) {
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
        impostorCount: 1,
      },
      players: [],
      teacherToken: secret,
      teacherSockets: new Set([socketId]),
      manualImpostorIds: [],
      impostorIds: [],
      word: null,
      deadline: null,
      clueDeadline: null,
      votes: new Map(),
      ballotId: null,
      swaps: [],
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
      originalPowers: [],
      avatar,
      online: true,
      ready: false,
      alive: !spectator,
      spectator,
      clue: null,
      voted: false,
      sockets: new Set([socketId]),
      powers: [],
      exclusivePower: null,
      vestigeLetter: null,
      effects: freshEffects(),
      usedPowerRound: 0,
      fakeClue: null,
      rewriteUntil: 0,
      notifications: [],
      noticeSequence: 0,
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
  public(room: Room, auth?: Auth, base?: PublicRoom): PublicRoom {
    if (base) return projectRoom(room, base, auth?.playerId);
    const state: PublicRoom = {
      code: room.code,
      revision: room.revision,
      phase: room.phase,
      round: room.round,
      settings: structuredClone(room.settings),
      // Explicit allowlist: effects, loadouts, notification recipients and authors stay private.
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        online: p.online,
        ready: p.ready,
        alive: p.alive,
        spectator: p.spectator,
        clue: p.clue ?? p.fakeClue,
        voted: p.voted,
      })),
      teacherOnline: room.teacherSockets.size > 0,
      deadline: room.deadline,
      clueDeadline: room.clueDeadline,
      clueCount: this.active(room).filter((p) => p.clue !== null).length,
      eligibleVoters: this.active(room).filter(
        (p) => p.effects.bannedVoteRound !== room.round || room.round === 0,
      ).length,
      category: room.word?.categoria ?? null,
      candidates: [...room.candidates],
      ballotId: room.ballotId,
      immuneIds: this.active(room)
        .filter((p) => p.effects.chosenRound === room.round && roundLive(room))
        .map((p) => p.id),
      voteResult: room.voteResult ? structuredClone(room.voteResult) : null,
      history: structuredClone(room.history),
      eliminations: structuredClone(room.eliminations),
      result: room.result ? structuredClone(room.result) : null,
    };
    return projectRoom(room, state, auth?.playerId);
  }
  privateState(room: Room, auth: Auth): PrivateState {
    if (auth.kind === 'display') return { kind: 'display' };
    if (auth.kind === 'teacher') {
      this.teacher(room, auth);
      return {
        kind: 'teacher',
        word: room.word ? { ...room.word } : null,
        impostorIds: [...room.impostorIds],
        manualImpostorIds: [...room.manualImpostorIds],
        identities: room.players.map((p) => ({ id: p.id, name: p.name })),
      };
    }
    const p = this.player(room, auth);
    const role = p.spectator
      ? 'spectator'
      : !room.word
        ? null
        : room.impostorIds.includes(p.id)
          ? 'impostor'
          : 'civil';
    return {
      kind: 'player',
      playerId: p.id,
      role,
      word: role === 'civil' && room.word ? { ...room.word } : null,
      impostorIds: role === 'impostor' ? [...room.impostorIds] : [],
      powers: p.powers.map((s) => ({ ...s })),
      exclusivePower: role === 'impostor' && p.exclusivePower ? { ...p.exclusivePower } : null,
      vestigeLetter: role === 'impostor' ? p.vestigeLetter : null,
      usedPowerRound: p.usedPowerRound,
      effects: structuredClone(p.effects),
      clueSubmitted: p.clue !== null,
      clueDeadline: room.phase === 'CLUES' ? p.rewriteUntil || room.clueDeadline : null,
      notifications: p.notifications.map((n) => ({ ...n })),
      ballot:
        room.ballotId && room.votes.has(p.id)
          ? { ballotId: room.ballotId, targetId: room.votes.get(p.id)!.targetId }
          : null,
    };
  }
  execute(auth: Auth, cmd: Command) {
    const room = this.room(auth.code);
    // Never accept a stale/forged identity merely because it has the same room code.
    if (auth.kind === 'teacher') this.teacher(room, auth);
    else if (auth.kind === 'player') this.player(room, auth);
    else fail('FORBIDDEN', 'O telão é somente para leitura.');
    const key = auth.token!;
    const seen = room.requests.get(key) ?? new Map<string, CommandResult>();
    if (seen.has(cmd.requestId)) return seen.get(cmd.requestId)!;
    let result: CommandResult = {};
    let privateChanged: boolean | string[] = false;
    switch (cmd.type) {
      case 'player:ready': {
        this.requirePhase(room, 'LOBBY');
        const p = this.player(room, auth);
        if (
          cmd.ready &&
          (p.powers.length !== LOADOUT_SIZE ||
            new Set(p.powers.map((s) => s.id)).size !== LOADOUT_SIZE)
        )
          fail('CHOOSE_POWERS', 'Escolha três poderes diferentes antes de ficar pronto.');
        p.avatar = cmd.avatar;
        p.ready = cmd.ready;
        break;
      }
      case 'player:powers': {
        this.requirePhase(room, 'LOBBY');
        const p = this.player(room, auth);
        if (
          cmd.powers.length > LOADOUT_SIZE ||
          new Set(cmd.powers).size !== cmd.powers.length ||
          cmd.powers.some((id) => !POWER_IDS.some((available) => available === id))
        )
          fail('INVALID_POWERS', 'Escolha até três poderes diferentes.');
        p.powers = cmd.powers.map((id) => ({ id, readyRound: 0, used: false }));
        p.originalPowers = [...cmd.powers];
        p.ready = false;
        privateChanged = [p.id];
        break;
      }
      case 'power:activate': {
        const activated = this.activatePower(room, auth, cmd);
        result = { activation: activated.notice };
        privateChanged = activated.changed;
        break;
      }
      case 'teacher:settings': {
        this.teacher(room, auth);
        this.requirePhase(room, 'LOBBY');
        const ids = cmd.manualImpostorIds;
        if (
          ![1, 2, 3].includes(cmd.settings.impostorCount) ||
          ids.length > 3 ||
          new Set(ids).size !== ids.length ||
          ids.some((id) => !room.players.some((p) => p.id === id && !p.spectator))
        )
          fail('SELECT_IMPOSTOR', 'Escolha participantes diferentes para os impostores.');
        room.settings = structuredClone(cmd.settings);
        room.manualImpostorIds = [...ids];
        privateChanged = ['teacher'];
        break;
      }
      case 'teacher:remove': {
        this.teacher(room, auth);
        this.requirePhase(room, 'LOBBY');
        const p =
          room.players.find((p) => p.id === cmd.playerId) ??
          fail('PLAYER_NOT_FOUND', 'Aluno não encontrado.');
        room.players = room.players.filter((x) => x.id !== p.id);
        room.requests.delete(p.token);
        room.manualImpostorIds = room.manualImpostorIds.filter((id) => id !== p.id);
        privateChanged = ['teacher'];
        this.options.onRemove?.(room.code, p.id, [...p.sockets]);
        break;
      }
      case 'game:start': {
        this.teacher(room, auth);
        this.requirePhase(room, 'LOBBY');
        const alive = this.active(room);
        const minimum = room.settings.impostorCount * 2 + 1;
        if (alive.length < minimum)
          fail(
            'NOT_ENOUGH_PLAYERS',
            `São necessários pelo menos ${minimum} alunos para ${room.settings.impostorCount} impostor(es).`,
          );
        if (alive.some((p) => !p.ready || !p.online))
          fail('NOT_READY', 'Todos os alunos precisam estar conectados e prontos.');
        if (alive.some((p) => p.powers.length !== LOADOUT_SIZE))
          fail('CHOOSE_POWERS', 'Todos precisam escolher três poderes.');
        if (
          room.settings.selectionMode === 'manual' &&
          (room.manualImpostorIds.length !== room.settings.impostorCount ||
            room.manualImpostorIds.some((id) => !alive.some((p) => p.id === id)))
        )
          fail('SELECT_IMPOSTOR', 'Escolha o impostor antes de começar.');
        const poolIds = alive.map((p) => p.id);
        room.impostorIds =
          room.settings.selectionMode === 'manual' ? [...room.manualImpostorIds] : [];
        if (room.settings.selectionMode === 'random')
          for (let i = 0; i < room.settings.impostorCount; i++)
            room.impostorIds.push(poolIds.splice(randomInt(poolIds.length), 1)[0]);
        for (const player of room.players) {
          player.exclusivePower = room.impostorIds.includes(player.id)
            ? { id: IMPOSTOR_POWER_ID, readyRound: 0, used: false }
            : null;
          player.vestigeLetter = null;
        }
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
          this.touch(room, true);
        });
        privateChanged = true;
        break;
      }
      case 'clue:submit': {
        this.requirePhase(room, 'CLUES');
        const p = this.eligible(room, auth);
        if (this.now() >= (p.rewriteUntil || room.clueDeadline || 0)) {
          this.advanceClues(room);
          this.touch(room, true);
          fail('TIME_UP', 'O tempo para enviar sua dica terminou.');
        }
        if (p.effects.silencedUntil > this.now())
          fail('SILENCED', 'Você está silenciado. Aguarde o contador terminar.');
        if (p.clue !== null) fail('ALREADY_SUBMITTED', 'Você já enviou sua dica nesta rodada.');
        const text = this.clueText(room, p, cmd.text);
        if (
          p.effects.forbiddenLetter &&
          normalize(text).includes(p.effects.forbiddenLetter.toLowerCase())
        )
          fail(
            'FORBIDDEN_LETTER',
            `Sua dica não pode conter a letra ${p.effects.forbiddenLetter}, mesmo acentuada.`,
          );
        if (
          p.effects.labyrinthWords.length &&
          !p.effects.labyrinthWords.some((w) =>
            (' ' + normalize(text) + ' ').includes(' ' + normalize(w) + ' '),
          )
        )
          fail(
            'LABYRINTH_WORD',
            'Inclua uma destas palavras: ' + p.effects.labyrinthWords.join(', ') + '.',
          );
        p.effects.labyrinthWords = [];
        p.clue = text;
        p.fakeClue = null;
        p.effects.forbiddenLetter = null;
        privateChanged = [p.id];
        this.advanceClues(room);
        break;
      }
      case 'clues:close':
        this.teacher(room, auth);
        this.requirePhase(room, 'CLUES');
        room.clueDeadline = this.now();
        this.advanceClues(room);
        privateChanged = true;
        break;
      case 'vote:open': {
        this.teacher(room, auth);
        this.requirePhase(room, 'WAITING_FOR_VOTE', 'TIEBREAK');
        room.runoff = room.phase === 'TIEBREAK';
        room.phase = 'VOTING';
        room.ballotId = randomBytes(12).toString('hex');
        room.votes.clear();
        room.players.forEach((p) => (p.voted = false));
        room.voteResult = null;
        privateChanged = true;
        break;
      }
      case 'vote:submit': {
        this.requirePhase(room, 'VOTING');
        const p = this.eligible(room, auth);
        if (p.effects.bannedVoteRound === room.round)
          fail('VOTE_BANNED', 'Exílio do Veredito impede seu voto nesta rodada.');
        if (cmd.ballotId !== room.ballotId)
          fail('STALE_BALLOT', 'Esta votação já terminou. Atualize sua escolha.');
        if (room.votes.has(p.id)) fail('ALREADY_VOTED', 'Seu voto já foi confirmado.');
        if (cmd.targetId === p.id) fail('SELF_VOTE', 'Você não pode votar em si mesmo.');
        if (
          cmd.targetId !== null &&
          (!this.active(room).some(
            (p) => p.id === cmd.targetId && p.effects.chosenRound !== room.round,
          ) ||
            (room.runoff && !room.candidates.includes(cmd.targetId)))
        )
          fail('INVALID_TARGET', 'Escolha um suspeito elegível.');
        const weight =
          (p.effects.dice?.round === room.round ? p.effects.dice.value : 1) *
          (p.effects.doubleVoteRound === room.round ? 2 : 1);
        room.votes.set(p.id, {
          targetId: cmd.targetId,
          weight: cmd.targetId === null ? 0 : weight,
        });
        p.voted = true;
        privateChanged = [p.id];
        break;
      }
      case 'vote:close':
        this.teacher(room, auth);
        this.requirePhase(room, 'VOTING');
        this.closeVote(room);
        break;
      case 'round:next':
        this.teacher(room, auth);
        this.requirePhase(room, 'WAITING_FOR_NEXT_ROUND');
        room.round++;
        this.startClues(room);
        privateChanged = true;
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
        room.impostorIds = [];
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
          p.fakeClue = null;
          p.rewriteUntil = 0;
          p.effects = freshEffects();
          p.exclusivePower = null;
          p.vestigeLetter = null;
          p.powers = p.originalPowers.map((id) => ({ id, readyRound: 0, used: false }));
          p.usedPowerRound = 0;
          p.notifications = [];
        });
        room.votes.clear();
        room.ballotId = null;
        room.swaps = [];
        room.candidates = [];
        room.voteResult = null;
        room.history = [];
        room.eliminations = [];
        room.runoff = false;
        room.clueDeadline = null;
        privateChanged = true;
        break;
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
    seen.set(cmd.requestId, result);
    if (seen.size > 256) seen.delete(seen.keys().next().value!);
    room.requests.set(key, seen);
    this.touch(room, privateChanged);
    return result;
  }
  private startClues(room: Room) {
    room.phase = 'CLUES';
    room.candidates = [];
    room.voteResult = null;
    room.runoff = false;
    room.ballotId = null;
    room.votes.clear();
    transformPowers(room, this.options.random ?? randomInt, (p, id, message) =>
      this.notice(room, p, id, 'Caixa de Pandora transformada', message, 'success'),
    );
    room.swaps = room.swaps.filter((s) => s.round >= room.round);
    room.players.forEach((p) => {
      p.clue = null;
      p.voted = false;
      p.fakeClue = null;
      p.rewriteUntil = 0;
      p.effects.hiddenImageRounds = p.effects.hiddenImageRounds.filter((r) => r >= room.round);
    });
    room.history.push({ round: room.round, clues: [], votes: [] });
    room.clueDeadline = this.now() + room.settings.clueSeconds * 1000;
    this.advanceClues(room);
  }
  private advanceClues(room: Room) {
    const now = this.now();
    const alive = this.active(room);
    const pending = alive.filter((p) => p.clue === null && p.rewriteUntil > now);
    const allDone = alive.every(
      (p) => p.clue !== null || (p.rewriteUntil > 0 && p.rewriteUntil <= now),
    );
    if (allDone || (now >= (room.clueDeadline ?? 0) && pending.length === 0)) {
      this.endClues(room);
      return;
    }
    this.clearTimer(room);
    const normal = room.clueDeadline! > now;
    room.deadline = normal ? room.clueDeadline : Math.max(...pending.map((p) => p.rewriteUntil));
    const future = pending.map((p) => p.rewriteUntil);
    if (normal) future.push(room.clueDeadline!);
    const wake = Math.min(...future);
    room.timer = setTimeout(
      () => {
        if (room.phase !== 'CLUES') return;
        this.advanceClues(room);
        this.touch(room, true);
      },
      Math.max(1, wake - now),
    );
    room.timer.unref();
  }
  private endClues(room: Room) {
    this.clearTimer(room);
    room.phase = 'WAITING_FOR_VOTE';
    const history = room.history.at(-1)!;
    history.clues = this.active(room).map((p) => ({
      playerId: p.id,
      name: p.name,
      text: p.clue ?? p.fakeClue ?? 'Sem dica',
    }));
  }
  private closeVote(room: Room) {
    const counts: Record<string, number> = {};
    for (const ballot of room.votes.values())
      if (ballot.targetId !== null && ballot.weight > 0)
        counts[ballot.targetId] = (counts[ballot.targetId] ?? 0) + ballot.weight;
    const max = Math.max(0, ...Object.values(counts));
    const tied = Object.keys(counts).filter((id) => counts[id] === max);
    const result: VoteResult = {
      counts,
      tied: tied.length > 1 ? tied : [],
      eliminatedId: tied.length === 1 ? tied[0] : null,
      runoff: room.runoff,
      noVotes: max === 0,
      protectedId: null,
      abstentions: [...room.votes.values()].filter((v) => v.targetId === null).length,
    };
    const protectedPlayer = room.players.find(
      (p) => p.id === result.eliminatedId && p.effects.aegis,
    );
    if (protectedPlayer) {
      protectedPlayer.effects.aegis = false;
      result.protectedId = protectedPlayer.id;
      result.eliminatedId = null;
      this.notice(
        room,
        protectedPlayer,
        'aegis',
        'Seu escudo protegeu você',
        'Égide do Destino impediu sua eliminação. O escudo foi destruído.',
        'success',
      );
    }
    room.voteResult = result;
    room.history.at(-1)!.votes.push(structuredClone(result));
    room.phase = 'VOTE_RESULTS';
    this.schedule(room, this.options.resultMs ?? 2800, () => {
      if (result.eliminatedId) {
        const p = room.players.find((p) => p.id === result.eliminatedId)!;
        p.alive = false;
        room.eliminations.push({ playerId: p.id, name: p.name, round: room.round });
        room.phase = 'ELIMINATION';
        const impostors = this.active(room).filter((p) => room.impostorIds.includes(p.id)).length;
        const civilians = this.active(room).length - impostors;
        if (impostors === 0) this.finish(room, 'civis');
        else if (impostors >= civilians) this.finish(room, 'impostor');
        else
          this.schedule(room, this.options.resultMs ?? 2800, () => {
            finishEffects(room);
            room.phase = 'WAITING_FOR_NEXT_ROUND';
            this.clearTimer(room);
            this.touch(room, true);
          });
      } else if (result.tied.length > 1 && !room.runoff) {
        this.clearTimer(room);
        room.candidates = [...result.tied];
        room.phase = 'TIEBREAK';
      } else {
        this.clearTimer(room);
        room.candidates = [];
        finishEffects(room);
        room.phase = 'WAITING_FOR_NEXT_ROUND';
      }
      this.touch(room, true);
    });
    this.touch(room, protectedPlayer ? [protectedPlayer.id] : false);
  }
  private finish(room: Room, winner: 'civis' | 'impostor' | 'cancelada') {
    this.clearTimer(room);
    finishEffects(room);
    room.phase = 'GAME_OVER';
    room.result = { winner, impostorIds: [...room.impostorIds], word: { ...room.word! } };
  }
  private clueText(room: Room, author: Player, raw: string) {
    const text = raw
      .normalize('NFC')
      .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
      .trim()
      .replace(/\s+/g, ' ');
    if (!text || Array.from(text).length > 80)
      fail('INVALID_CLUE', 'Escreva uma dica com até 80 caracteres.');
    if (
      !room.impostorIds.includes(author.id) &&
      ` ${normalize(text)} `.includes(` ${normalize(room.word!.nome)} `)
    )
      fail('WORD_IN_CLUE', 'Dê uma pista sem escrever a palavra secreta.');
    return text;
  }
  private notice(
    room: Room,
    player: Player,
    powerId: PowerId,
    title: string,
    message: string,
    tone: PowerNotice['tone'],
  ) {
    const notice: PowerNotice = {
      id: ++player.noticeSequence,
      powerId,
      title,
      message,
      tone,
      round: room.round,
    };
    player.notifications.push(notice);
    if (player.notifications.length > 32) player.notifications.shift();
    return notice;
  }
  private activatePower(room: Room, auth: Auth, cmd: Extract<Command, { type: 'power:activate' }>) {
    const actor = this.eligible(room, auth);
    const def = POWERS[cmd.powerId];
    if (cmd.powerId === IMPOSTOR_POWER_ID && !room.impostorIds.includes(actor.id))
      fail('IMPOSTOR_ONLY', 'Vestígio do Invisível é exclusivo dos impostores.');
    const slot =
      cmd.powerId === IMPOSTOR_POWER_ID
        ? actor.exclusivePower
        : actor.powers.find((p) => p.id === cmd.powerId);
    if (!def || !slot) fail('POWER_NOT_SELECTED', 'Este poder não foi escolhido para a partida.');
    this.requirePhase(room, ...ACTIVE_POWER_PHASES);
    if (
      def.window === 'clues' &&
      (room.phase !== 'CLUES' || this.now() >= (room.clueDeadline ?? 0))
    )
      fail('POWER_WINDOW', 'Este poder só pode ser ativado durante o prazo normal das dicas.');
    if (actor.usedPowerRound === room.round)
      fail('ONE_POWER_PER_ROUND', 'Você já ativou um poder nesta rodada.');
    if (def.once && slot!.used) fail('POWER_SPENT', 'Este poder já foi usado nesta partida.');
    if ((slot!.blockedUntilRound ?? 0) >= room.round)
      fail(
        'POWER_SUSPENDED',
        'Mão Divina suspendeu este poder até a rodada ' + (slot!.blockedUntilRound! + 1) + '.',
      );
    if (slot!.readyRound > room.round)
      fail('POWER_COOLDOWN', `Este poder volta na rodada ${slot!.readyRound}.`);
    const target =
      def.target === 'self'
        ? actor
        : room.players.find((p) => p.id === cmd.targetId && p.alive && !p.spectator);
    if (
      !target ||
      (def.target === 'other' && target.id === actor.id) ||
      (def.target === 'self' && cmd.targetId && cmd.targetId !== actor.id)
    )
      fail('INVALID_TARGET', 'Escolha um participante vivo e elegível.');
    const to = target!;
    const e = to.effects;
    const now = this.now();
    const effectMs = this.options.effectMs ?? 20_000;
    const duplicate = () =>
      fail('EFFECT_ACTIVE', 'Esse efeito já está ativo. Seu poder não foi gasto.');
    let fakeText = '';
    switch (cmd.powerId) {
      case 'silence':
        if (to.clue !== null || now >= (to.rewriteUntil || room.clueDeadline || 0))
          fail('INVALID_TARGET', 'Escolha alguém que ainda pode enviar uma dica.');
        if (e.silencedUntil > now) duplicate();
        break;
      case 'letter':
        if (e.forbiddenLetter) duplicate();
        break;
      case 'aegis':
        if (e.aegis) duplicate();
        break;
      case 'double_vote':
        if (e.doubleVoteRound === room.round) duplicate();
        if (e.bannedVoteRound === room.round)
          fail('VOTE_BANNED', 'Você não pode votar nesta rodada. Seu poder não foi gasto.');
        if (room.phase === 'VOTING' && to.voted)
          fail('ALREADY_VOTED', 'Ative antes de confirmar seu voto.');
        break;
      case 'ban_vote':
        if (e.bannedVoteRound === room.round) duplicate();
        if (room.phase === 'VOTING' && to.voted)
          fail('ALREADY_VOTED', 'Esse jogador já confirmou o voto.');
        break;
      case 'echo':
        if (to.clue !== null || now >= (to.rewriteUntil || room.clueDeadline || 0))
          fail('INVALID_TARGET', 'Escolha alguém que ainda não enviou sua dica verdadeira.');
        if (to.fakeClue !== null) duplicate();
        fakeText = this.clueText(room, actor, cmd.text ?? '');
        break;
      case 'refuge':
        if (e.refuge) duplicate();
        break;
      case 'erase':
        if (to.clue === null)
          fail('INVALID_TARGET', 'Escolha alguém que já enviou uma dica verdadeira.');
        break;
      case 'veil':
        if (e.hiddenImageRounds.includes(room.round + 1)) duplicate();
        break;
    }
    const prepared = prepareNewPower(room, actor, to, cmd.powerId, slot!, {
      now,
      random: this.options.random ?? randomInt,
      fail,
      notice: (player, id, title, message, tone) =>
        this.notice(room, player, id, title, message, tone),
    });
    // Validation above is side-effect free. Every accepted attempt below is charged exactly once.
    actor.usedPowerRound = room.round;
    slot!.used = true;
    slot!.readyRound = room.round + (slot!.cooldown ?? 4);
    const changed = [...new Set([actor.id, to.id, ...(prepared?.changed ?? [])])];
    const hostile = def.target === 'other';
    if (hostile && e.refuge) {
      e.refuge = false;
      const notice = this.notice(
        room,
        actor,
        cmd.powerId,
        'Poder bloqueado',
        `${def.name} foi absorvido por uma proteção. A tentativa foi usada.`,
        'info',
      );
      this.notice(
        room,
        to,
        'refuge',
        'Sua barreira protegeu você',
        `Refúgio Estoico absorveu ${def.name}. A barreira foi consumida.`,
        'success',
      );
      return { notice, changed };
    }
    let message = '';
    let targetMessage = '';
    let tone: PowerNotice['tone'] = 'success';
    switch (cmd.powerId) {
      case 'vestige':
        actor.vestigeLetter = Array.from(room.word!.nome)
          .find((char) => /\p{L}/u.test(char))!
          .toLocaleUpperCase('pt-BR');
        message = `A primeira letra da palavra é ${actor.vestigeLetter}. Só você recebeu esta pista.`;
        break;
      case 'silence':
        e.silencedUntil = now + effectMs;
        if (to.rewriteUntil > now)
          to.rewriteUntil = Math.max(to.rewriteUntil, e.silencedUntil + effectMs);
        message = `O jogador escolhido não pode escrever dicas por 20 segundos.`;
        targetMessage =
          'Você não pode escrever nem enviar dicas por 20 segundos. Seu rascunho foi preservado.';
        this.advanceClues(room);
        break;
      case 'letter':
        const letters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter(
          (l) =>
            !e.labyrinthWords.length ||
            e.labyrinthWords.some((w) => !normalize(w).includes(l.toLowerCase())),
        );
        e.forbiddenLetter = letters[(this.options.random ?? randomInt)(letters.length)];
        message = `O jogador escolhido não poderá usar a letra ${e.forbiddenLetter} na próxima dica verdadeira.`;
        targetMessage = `Sua próxima dica verdadeira não pode conter a letra ${e.forbiddenLetter}, mesmo acentuada.`;
        break;
      case 'aegis':
        e.aegis = true;
        message = `O jogador escolhido está protegido contra a próxima eliminação.`;
        targetMessage =
          'Você está protegido contra a próxima eliminação. O escudo permanece até ser consumido.';
        break;
      case 'double_vote':
        e.doubleVoteRound = room.round;
        message = 'Seu voto vale por dois nesta rodada, incluindo os desempates.';
        break;
      case 'ban_vote':
        e.bannedVoteRound = room.round;
        message = `O jogador escolhido não poderá votar nesta rodada.`;
        targetMessage = 'Você não poderá votar nesta rodada, incluindo os desempates.';
        break;
      case 'oracle': {
        const success = (this.options.random ?? randomInt)(2) === 1;
        message = success
          ? `O jogador escolhido: ${room.impostorIds.includes(to.id) ? 'Impostor' : 'Civil'}.`
          : 'A leitura falhou. Nenhum papel foi revelado.';
        targetMessage = success
          ? 'Uma consulta revelou seu papel a alguém. A identidade de quem consultou permanece secreta.'
          : 'Uma tentativa de consultar seu papel falhou. Nenhum papel foi revelado.';
        if (!success) tone = 'info';
        break;
      }
      case 'echo':
        to.fakeClue = fakeText;
        message = `Uma dica falsa apareceu no nome do jogador escolhido.`;
        targetMessage =
          'Uma dica falsa apareceu no seu nome. Envie sua dica verdadeira para substituí-la.';
        break;
      case 'refuge':
        e.refuge = true;
        message =
          'Você está protegido do próximo poder hostil. A barreira permanece até absorvê-lo.';
        break;
      case 'erase':
        to.clue = null;
        to.fakeClue = null;
        to.rewriteUntil = Math.max(now, e.silencedUntil) + effectMs;
        message = `A dica do jogador escolhido foi apagada. O alvo tem 20 segundos para reenviar.`;
        targetMessage =
          'Sua dica foi apagada. Você tem 20 segundos para reenviar; se estiver silenciado, o prazo começa após o silêncio.';
        this.advanceClues(room);
        break;
      case 'veil':
        e.hiddenImageRounds.push(room.round + 1);
        message = `O jogador escolhido ficará sem a imagem do item na próxima rodada.`;
        targetMessage =
          'Na próxima rodada a imagem do item ficará oculta. O nome da palavra e as pistas continuam visíveis.';
        break;
    }
    if (prepared) {
      const applied = prepared.apply();
      message = applied.message;
      targetMessage = applied.targetMessage ?? '';
    }
    const notice = this.notice(room, actor, cmd.powerId, `${def.name} ativado`, message, tone);
    if (to !== actor)
      this.notice(
        room,
        to,
        cmd.powerId,
        `Você foi alvo de ${def.name}`,
        targetMessage,
        ['aegis', 'chosen', 'prometheus'].includes(cmd.powerId) ? 'success' : 'danger',
      );
    return { notice, changed };
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
