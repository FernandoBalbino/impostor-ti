import { io, type Socket } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import { PROTOCOL_VERSION } from '@impostor/shared';
import type {
  Ack,
  ClientEvents,
  Command,
  PrivateState,
  PublicRoom,
  ServerEvents,
  Session,
} from '@impostor/shared';
export const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export async function until(check: () => boolean, timeout = 15000) {
  const end = Date.now() + timeout;
  while (!check()) {
    if (Date.now() > end) throw new Error('Timed out waiting for synchronized state');
    await pause(25);
  }
}
export class Client {
  socket: Socket<ServerEvents, ClientEvents>;
  room: PublicRoom | null = null;
  privateState: PrivateState | null = null;
  session?: Session;
  updates = 0;
  latencies: number[] = [];
  disconnects = 0;
  packets: unknown[] = [];
  constructor(url: string, origin?: string) {
    this.socket = io(url, {
      autoConnect: false,
      transports: ['websocket'],
      forceNew: true,
      timeout: 20000,
      reconnection: false,
      extraHeaders: origin ? { Origin: origin } : undefined,
    });
    this.socket.on('update', (u) => {
      this.updates++;
      if (this.room && u.revision > this.room.revision)
        this.room = { ...this.room, ...u.changes, revision: u.revision };
    });
    this.socket.on('privateState', (p) => (this.privateState = p));
    this.socket.on('disconnect', () => this.disconnects++);
    this.socket.onAny((event, ...data) => {
      this.packets.push({ event, data });
      if (this.packets.length > 100) this.packets.shift();
    });
  }
  async connect() {
    const connected = new Promise<void>((resolve, reject) => {
      this.socket.once('connect', resolve);
      this.socket.once('connect_error', reject);
    });
    this.socket.connect();
    await connected;
  }
  async raw(data: Record<string, unknown>): Promise<Ack> {
    const start = performance.now();
    const result: Ack = await this.socket
      .timeout(15000)
      .emitWithAck('command', {
        protocolVersion: PROTOCOL_VERSION,
        ...data,
        requestId: data.requestId ?? randomUUID(),
      } as Command);
    this.latencies.push(performance.now() - start);
    if (result.ok) {
      if (result.snapshot) {
        this.room = result.snapshot.room;
        this.privateState = result.snapshot.privateState;
      }
      if (result.session) this.session = result.session;
    }
    return result;
  }
  async send(data: Record<string, unknown>) {
    const result = await this.raw(data);
    if (!result.ok) throw new Error(`${data.type}: ${result.code} ${result.message}`);
    return result;
  }
  async reconnect() {
    if (!this.session) throw new Error('No session');
    this.socket.disconnect();
    await pause(100);
    await this.connect();
    await this.send({ type: 'session:resume', code: this.session.code, token: this.session.token });
  }
  close() {
    this.socket.disconnect();
  }
}
