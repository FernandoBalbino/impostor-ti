import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { Ack, ClientEvents, ServerEvents, Command, PublicRoom } from '@impostor/shared';
import { PROTOCOL_VERSION } from '@impostor/shared';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { GameEngine, GameError, type Auth } from './engine.js';
import { CommandSchema } from './validation.js';

export function createGameServer(
  options: {
    origins?: string[];
    revealMs?: number;
    resultMs?: number;
    effectMs?: number;
    random?: (max: number) => number;
  } = {},
) {
  const origins =
    options.origins ??
    (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
      .split(',')
      .map((s) => s.trim());
  const app = express();
  app.disable('x-powered-by');
  const httpServer = createServer(app);
  const io = new Server<ClientEvents, ServerEvents, Record<string, never>, { auth?: Auth }>(
    httpServer,
    {
      cors: { origin: origins, methods: ['GET', 'POST'] },
      maxHttpBufferSize: 8192,
      perMessageDeflate: false,
      serveClient: false,
      allowRequest: (req, callback) =>
        callback(null, !req.headers.origin || origins.includes(req.headers.origin)),
      pingInterval: 20_000,
      pingTimeout: 20_000,
    },
  );
  const previous = new Map<string, PublicRoom>();
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  const histogram = monitorEventLoopDelay({ resolution: 20 });
  histogram.enable();
  let commandCount = 0;
  const publish = (room: ReturnType<GameEngine['room']>) => {
    const timer = pending.get(room.code);
    if (timer) clearTimeout(timer);
    pending.delete(room.code);
    const state = engine.public(room);
    const old = previous.get(room.code);
    const changes: Partial<PublicRoom> = {};
    for (const key of Object.keys(state) as (keyof PublicRoom)[]) {
      if (key !== 'revision' && (!old || JSON.stringify(state[key]) !== JSON.stringify(old[key])))
        (changes as Record<string, unknown>)[key] = state[key];
    }
    previous.set(room.code, state);
    if (Object.keys(changes).length)
      io.to(room.code).emit('update', {
        code: room.code,
        revision: room.revision,
        changes,
        serverTime: Date.now(),
      });
  };
  const engine = new GameEngine({
    revealMs: options.revealMs,
    resultMs: options.resultMs,
    effectMs: options.effectMs,
    random: options.random,
    onChange(room, privateChanged) {
      if (previous.get(room.code)?.phase !== room.phase) publish(room);
      else if (!pending.has(room.code)) {
        const timer = setTimeout(() => publish(room), 20);
        timer.unref();
        pending.set(room.code, timer);
      }
      if (privateChanged)
        for (const id of io.sockets.adapter.rooms.get(room.code) ?? []) {
          const socket = io.sockets.sockets.get(id);
          const auth = socket?.data.auth;
          if (
            socket &&
            auth &&
            (privateChanged === true ||
              privateChanged.includes(auth.kind === 'teacher' ? 'teacher' : (auth.playerId ?? '')))
          )
            socket.emit('privateState', engine.privateState(room, auth));
        }
    },
    onRemove(code, _id, sockets) {
      for (const id of sockets) {
        const socket = io.sockets.sockets.get(id);
        if (socket) {
          socket.emit('removed', 'Você saiu da sala ou foi removido pelo professor.');
          socket.leave(code);
          socket.data.auth = undefined;
        }
      }
    },
    onExpire(code) {
      const timer = pending.get(code);
      if (timer) clearTimeout(timer);
      pending.delete(code);
      previous.delete(code);
      io.to(code).emit('removed', 'Esta sala foi encerrada por inatividade.');
    },
  });
  app.use((req, res, next) => {
    if (req.headers.origin && origins.includes(req.headers.origin))
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.get('/health', (_req, res) =>
    res.json({
      status: 'ok',
      service: 'impostor-ti',
      version: '2.0.0',
      protocolVersion: PROTOCOL_VERSION,
      release: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'local',
      rooms: engine.rooms.size,
      metrics: {
        uptimeSeconds: Math.round(process.uptime()),
        rssBytes: process.memoryUsage().rss,
        heapBytes: process.memoryUsage().heapUsed,
        cpu: process.cpuUsage(),
        eventLoopP95Ms: Number((histogram.percentile(95) / 1e6).toFixed(2)),
        commands: commandCount,
        connections: io.engine.clientsCount,
      },
    }),
  );
  const ipLimits = new Map<string, { count: number; reset: number }>();
  const limited = (key: string, max: number) => {
    const now = Date.now();
    const entry = ipLimits.get(key);
    if (!entry || entry.reset < now) {
      ipLimits.set(key, { count: 1, reset: now + 60_000 });
      return false;
    }
    return ++entry.count > max;
  };
  const limitCleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, item] of ipLimits) if (item.reset < now) ipLimits.delete(key);
  }, 60_000);
  limitCleanup.unref();
  io.on('connection', (socket) => {
    const responses = new Map<string, Ack>();
    let count = 0;
    let reset = Date.now() + 60_000;
    socket.on('command', (raw, ack) => {
      if (typeof ack !== 'function') return;
      commandCount++;
      if (!raw || raw.protocolVersion !== PROTOCOL_VERSION) {
        ack({
          ok: false,
          code: 'UPDATE_REQUIRED',
          message: 'O jogo recebeu uma atualização. Atualize a página para continuar.',
        });
        return;
      }
      if (Date.now() > reset) {
        count = 0;
        reset = Date.now() + 60_000;
      }
      if (++count > 120) {
        ack({
          ok: false,
          code: 'RATE_LIMIT',
          message: 'Muitas ações em pouco tempo. Aguarde um momento.',
        });
        return;
      }
      const parsed = CommandSchema.safeParse(raw);
      if (!parsed.success) {
        ack({
          ok: false,
          code: 'INVALID_INPUT',
          message:
            'Verifique os dados enviados. O código deve ter 6 caracteres e as opções precisam ser válidas.',
        });
        return;
      }
      const cmd = parsed.data as Command;
      const cached = responses.get(cmd.requestId);
      if (cached) {
        ack(cached);
        return;
      }
      try {
        let response: Ack = { ok: true };
        const ip = socket.handshake.address;
        if (
          ['room:create', 'room:join', 'display:join'].includes(cmd.type) &&
          limited(`join:${ip}`, 180)
        )
          throw new GameError('RATE_LIMIT', 'Muitas tentativas de entrada. Aguarde um minuto.');
        if (['room:create', 'room:join', 'session:resume', 'display:join'].includes(cmd.type)) {
          if (socket.data.auth) {
            if (
              cmd.type === 'session:resume' &&
              cmd.code === socket.data.auth.code &&
              cmd.token === socket.data.auth.token
            ) {
              response = {
                ok: true,
                snapshot: {
                  protocolVersion: PROTOCOL_VERSION,
                  room: engine.public(engine.room(cmd.code)),
                  privateState: engine.privateState(engine.room(cmd.code), socket.data.auth),
                  serverTime: Date.now(),
                },
              };
            } else throw new GameError('ALREADY_JOINED', 'Você já está em uma sala nesta conexão.');
          } else {
            if (cmd.type === 'room:create') {
              if (limited(`create:${ip}`, 10) || engine.rooms.size >= 100)
                throw new GameError(
                  'RATE_LIMIT',
                  'Não foi possível criar outra sala agora. Tente novamente em um minuto.',
                );
              const created = engine.create(socket.id);
              socket.data.auth = created.auth;
              response = { ok: true, session: created.session };
            }
            if (cmd.type === 'room:join') {
              const joined = engine.join(cmd.code, cmd.name, cmd.avatar, socket.id);
              socket.data.auth = joined.auth;
              response = { ok: true, session: joined.session };
            }
            if (cmd.type === 'session:resume')
              socket.data.auth = engine.resume(cmd.code, cmd.token, socket.id);
            if (cmd.type === 'display:join') {
              const room = engine.room(cmd.code);
              socket.data.auth = { code: room.code, kind: 'display' };
            }
            const auth = socket.data.auth!;
            socket.join(auth.code);
            const room = engine.room(auth.code);
            response = {
              ...response,
              ok: true,
              snapshot: {
                protocolVersion: PROTOCOL_VERSION,
                room: engine.public(room),
                privateState: engine.privateState(room, auth),
                serverTime: Date.now(),
              },
            };
          }
        } else {
          if (!socket.data.auth)
            throw new GameError('UNAUTHORIZED', 'Entre em uma sala para continuar.');
          response = { ok: true, ...engine.execute(socket.data.auth, cmd) };
        }
        responses.set(cmd.requestId, response);
        if (responses.size > 100) responses.delete(responses.keys().next().value!);
        ack(response);
      } catch (error) {
        if (!(error instanceof GameError))
          console.error(
            'Command failed:',
            error instanceof Error ? error.message : 'Unknown error',
          );
        ack({
          ok: false,
          code: error instanceof GameError ? error.code : 'SERVER_ERROR',
          message:
            error instanceof GameError
              ? error.message
              : 'Não foi possível concluir. Tente novamente.',
        });
      }
    });
    socket.on('disconnect', () => {
      if (socket.data.auth) engine.disconnect(socket.data.auth, socket.id);
    });
  });
  return {
    app,
    httpServer,
    io,
    engine,
    close: async () => {
      histogram.disable();
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
      engine.close();
      clearInterval(limitCleanup);
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
if (process.env.NODE_ENV !== 'test') {
  const { httpServer } = createGameServer();
  const port = Number(process.env.PORT ?? 3001);
  httpServer.listen(port, '0.0.0.0', () => console.log(`Impostor TI listening on port ${port}`));
}
