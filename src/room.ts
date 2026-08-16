import { WebSocketServer, WebSocket } from 'ws';
import type { ClientMsg, Ev, ServerMsg } from './protocol.js';
import { HISTORY_LIMIT } from './protocol.js';

export interface RoomCallbacks {
  onInput(name: string, text: string): void;
  onJoin(name: string): void;
  onLeave(name: string): void;
  /** Control commands from `copair ctl` (attach mode). Return text to show the caller. */
  onCtl?(cmd: 'kick' | 'who' | 'stop', arg: string | undefined): string;
  /** Full transcript for `copair fork` requests (attach mode). */
  onFork?(): string | null;
}

/**
 * The host-side hub: accepts guests over websocket, validates the invite
 * token, replays history on join and broadcasts events to everyone.
 */
export class Room {
  private wss: WebSocketServer;
  private guests = new Map<WebSocket, string>();
  private history: Ev[] = [];

  constructor(
    port: number,
    private token: string,
    private hostName: string,
    private cb: RoomCallbacks,
  ) {
    this.wss = new WebSocketServer({ port, host: '0.0.0.0' });
    this.wss.on('connection', (ws) => this.handleConnection(ws));
    this.wss.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`port ${port} is already in use — is another copair running? Try --port ${port + 1}`);
      } else {
        console.error(`server error: ${err.message}`);
      }
      process.exit(1);
    });
  }

  private handleConnection(ws: WebSocket): void {
    let name: string | null = null;
    let isCtl = false;
    let authed = false;
    const timeout = setTimeout(() => ws.close(), 10_000); // hello must arrive quickly

    ws.on('message', (raw) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.t === 'hello') {
        clearTimeout(timeout);
        // Empty room token = open mode: anyone who can reach the port may join.
        if (this.token && msg.token !== this.token) {
          this.send(ws, { t: 'denied', reason: 'bad token' });
          ws.close();
          return;
        }
        authed = true;
        if (msg.role === 'ctl' || msg.role === 'fork') {
          isCtl = msg.role === 'ctl';
          return;
        }
        name = this.uniqueName(String(msg.name || 'guest').slice(0, 32));
        this.guests.set(ws, name);
        this.send(ws, {
          t: 'welcome',
          history: this.history.slice(-500),
          roster: this.roster(),
          host: this.hostName,
        });
        this.cb.onJoin(name);
        this.broadcastRoster();
        return;
      }

      if (msg.t === 'input' && name) {
        const text = String(msg.text ?? '').slice(0, 20_000);
        if (text.trim()) this.cb.onInput(name, text);
        return;
      }

      if (msg.t === 'ctl' && isCtl && this.cb.onCtl) {
        this.send(ws, { t: 'ctlres', text: this.cb.onCtl(msg.cmd, msg.arg) });
        return;
      }

      if (msg.t === 'fork' && authed && this.cb.onFork) {
        const jsonl = this.cb.onFork();
        if (jsonl === null) this.send(ws, { t: 'denied', reason: 'fork not available in this mode' });
        else this.send(ws, { t: 'transcript', jsonl, host: this.hostName });
      }
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      if (name && this.guests.delete(ws)) {
        this.cb.onLeave(name);
        this.broadcastRoster();
      }
    });
    ws.on('error', () => ws.close());
  }

  private uniqueName(base: string): string {
    const taken = new Set([this.hostName, ...this.guests.values()]);
    if (!taken.has(base)) return base;
    let i = 2;
    while (taken.has(`${base}-${i}`)) i++;
    return `${base}-${i}`;
  }

  private send(ws: WebSocket, msg: ServerMsg): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  /** Record an event in history and push it to every guest. */
  broadcast(ev: Ev): void {
    this.history.push(ev);
    if (this.history.length > HISTORY_LIMIT) this.history.splice(0, this.history.length - HISTORY_LIMIT);
    for (const ws of this.guests.keys()) this.send(ws, { t: 'ev', ev });
  }

  roster(): string[] {
    return [this.hostName, ...this.guests.values()];
  }

  private broadcastRoster(): void {
    for (const ws of this.guests.keys()) this.send(ws, { t: 'roster', roster: this.roster() });
  }

  kick(name: string): boolean {
    for (const [ws, n] of this.guests) {
      if (n === name) {
        this.send(ws, { t: 'kicked' });
        ws.close();
        return true;
      }
    }
    return false;
  }

  close(): void {
    for (const ws of this.guests.keys()) ws.close();
    this.wss.close();
  }
}
