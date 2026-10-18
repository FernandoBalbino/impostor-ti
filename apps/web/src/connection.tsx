import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { PROTOCOL_VERSION } from '@impostor/shared';
import type {
  Ack,
  ClientEvents,
  Command,
  PrivateState,
  PublicRoom,
  ServerEvents,
  Session,
  Snapshot,
} from '@impostor/shared';
type Input = Command extends infer T
  ? T extends Command
    ? Omit<T, 'requestId' | 'protocolVersion'>
    : never
  : never;
const socketUrl =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.DEV
    ? `${location.protocol}//${location.hostname}:3001`
    : 'https://impostor-ti-api.onrender.com');
const apiUrl = import.meta.env.VITE_API_URL || socketUrl;
const sessionKey = 'impostor-ti.session.v1';
interface Connection {
  room: PublicRoom | null;
  privateState: PrivateState | null;
  connected: boolean;
  recovering: boolean;
  offset: number;
  error: string;
  clearError: () => void;
  send: (command: Input) => Promise<boolean>;
  leave: () => void;
  busy: boolean;
}
const Context = createContext<Connection>(null!);
export const useGame = () => useContext(Context);
export function GameProvider({ children }: { children: ReactNode }) {
  const route = useLocation();
  const path = useRef(route.pathname);
  path.current = route.pathname;
  const socket = useRef<Socket<ServerEvents, ClientEvents> | null>(null);
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [privateState, setPrivate] = useState<PrivateState | null>(null);
  const [connected, setConnected] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const snapshot = useCallback((data: Snapshot) => {
    if (data.protocolVersion !== PROTOCOL_VERSION) {
      setError('O jogo está sendo atualizado. Atualize a página em instantes.');
      return;
    }
    setRoom(data.room);
    setPrivate(data.privateState);
    setOffset(data.serverTime - Date.now());
  }, []);
  const process = useCallback(
    (result: Ack) => {
      if (!result.ok) {
        setError(result.message);
        if (['ROOM_NOT_FOUND', 'SESSION_EXPIRED'].includes(result.code)) {
          sessionStorage.removeItem(sessionKey);
          setRoom(null);
          setPrivate(null);
        }
        return false;
      }
      if (result.session) sessionStorage.setItem(sessionKey, JSON.stringify(result.session));
      if (result.snapshot) snapshot(result.snapshot);
      return true;
    },
    [snapshot],
  );
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${apiUrl}/health`, { signal: controller.signal }).catch(() => {});
    const client = io(socketUrl, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      timeout: 20000,
    });
    socket.current = client;
    client.on('connect', () => {
      setConnected(true);
      setError('');
      const displayCode = path.current.match(/^\/telao\/([A-Za-z2-9]{6})$/)?.[1];
      let saved: Session | null = null;
      try {
        saved = JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null');
      } catch {
        sessionStorage.removeItem(sessionKey);
      }
      const command: Input | null = displayCode
        ? { type: 'display:join', code: displayCode.toUpperCase() }
        : saved
          ? { type: 'session:resume', code: saved.code, token: saved.token }
          : null;
      if (command) {
        setRecovering(true);
        client
          .timeout(12000)
          .emit(
            'command',
            {
              ...command,
              protocolVersion: PROTOCOL_VERSION,
              requestId: crypto.randomUUID(),
            } as Command,
            (err: Error | null, result: Ack) => {
              setRecovering(false);
              if (err) {
                setError('A sincronização demorou. Reconectando…');
                client.disconnect();
                client.connect();
              } else process(result);
            },
          );
      } else setRecovering(false);
    });
    client.on('disconnect', () => {
      setConnected(false);
      setRecovering(true);
    });
    client.on('connect_error', () => {
      setConnected(false);
      setRecovering(true);
    });
    client.on('snapshot', snapshot);
    client.on('privateState', setPrivate);
    client.on('update', (update) => {
      setOffset(update.serverTime - Date.now());
      setRoom((old) =>
        old && old.code === update.code && update.revision > old.revision
          ? { ...old, ...update.changes, revision: update.revision }
          : old,
      );
    });
    client.on('removed', (message) => {
      setRoom(null);
      setPrivate(null);
      sessionStorage.removeItem(sessionKey);
      setError(message);
    });
    client.connect();
    return () => {
      controller.abort();
      client.disconnect();
      socket.current = null;
    };
  }, [process, snapshot]);
  const send = useCallback(
    async (command: Input) => {
      const client = socket.current;
      if (!client) return false;
      setBusy(true);
      setError('');
      try {
        if (!client.connected)
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              client.off('connect', done);
              reject(new Error('O servidor ainda está iniciando. Tente novamente em instantes.'));
            }, 90000);
            const done = () => {
              clearTimeout(timeout);
              resolve();
            };
            client.once('connect', done);
            client.connect();
          });
        const request = {
          ...command,
          protocolVersion: PROTOCOL_VERSION,
          requestId: crypto.randomUUID(),
        } as Command;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            return process(await client.timeout(6000).emitWithAck('command', request));
          } catch (err) {
            if (attempt === 2 || !client.connected) throw err;
          }
        }
        return false;
      } catch (err) {
        setError(
          err instanceof Error && err.message.includes('servidor')
            ? err.message
            : 'A conexão demorou para responder. Confira a internet e tente novamente.',
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [process],
  );
  const leave = useCallback(() => {
    const client = socket.current;
    if (client?.connected && room?.phase === 'LOBBY' && privateState?.kind === 'player')
      client.emit(
        'command',
        {
          type: 'session:leave',
          protocolVersion: PROTOCOL_VERSION,
          requestId: crypto.randomUUID(),
        },
        () => {},
      );
    sessionStorage.removeItem(sessionKey);
    setRoom(null);
    setPrivate(null);
    client?.disconnect();
    client?.connect();
  }, [room, privateState]);
  return (
    <Context.Provider
      value={{
        room,
        privateState,
        connected,
        recovering,
        offset,
        error,
        clearError: () => setError(''),
        send,
        leave,
        busy,
      }}
    >
      {children}
    </Context.Provider>
  );
}
