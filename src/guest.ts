import * as readline from 'node:readline';
import { WebSocket } from 'ws';
import type { ClientMsg, ServerMsg } from './protocol.js';
import { UI } from './ui.js';
import { bold, dim, red } from './util.js';

export interface GuestOptions {
  target: string; // host:port#token, with optional ws:// prefix
  name: string;
}

export function parseTarget(target: string): { url: string; token: string } | null {
  const m = target.match(/^(?:ws:\/\/)?([^#/\s]+)#(.+)$/);
  if (!m) return null;
  const hostPort = m[1].includes(':') ? m[1] : `${m[1]}:4747`;
  return { url: `ws://${hostPort}`, token: m[2] };
}

export async function runGuest(opts: GuestOptions): Promise<void> {
  const parsed = parseTarget(opts.target);
  if (!parsed) {
    console.error(red(`invalid target "${opts.target}" — expected host:port#token`));
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });
  const ui = new UI(rl);
  const ws = new WebSocket(parsed.url);
  const send = (msg: ClientMsg) => ws.send(JSON.stringify(msg));

  ws.on('open', () => {
    send({ t: 'hello', token: parsed.token, name: opts.name });
  });

  ws.on('message', (raw) => {
    let msg: ServerMsg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    switch (msg.t) {
      case 'welcome':
        ui.print(bold(`✓ joined ${msg.host}'s session as ${opts.name}`));
        ui.print(dim(`in the room: ${msg.roster.join(', ')} — tools run on ${msg.host}'s machine`));
        if (msg.history.length > 0) {
          ui.print(dim(`── replaying last ${msg.history.length} events ──`));
          for (const ev of msg.history) ui.event(ev);
          ui.print(dim('── you are live ──'));
        }
        rl.prompt();
        break;
      case 'ev':
        ui.event(msg.ev);
        break;
      case 'denied':
        ui.print(red(`join denied: ${msg.reason}`));
        process.exit(1);
        break;
      case 'kicked':
        ui.print(red('you were kicked from the session'));
        process.exit(0);
    }
  });

  ws.on('close', () => {
    ui.print(dim('disconnected — session over'));
    process.exit(0);
  });
  ws.on('error', (err) => {
    ui.print(red(`connection failed: ${err.message}`));
    process.exit(1);
  });

  rl.on('line', (raw) => {
    const text = raw.trim();
    if (!text) {
      rl.prompt();
      return;
    }
    if (text === '/leave' || text === '/quit') {
      ws.close();
      return;
    }
    if (text === '/help') {
      ui.print(dim('/leave to exit — "// text" chats without the agent'));
      return;
    }
    send({ t: 'input', text });
    rl.prompt();
  });
  rl.on('SIGINT', () => ws.close());
}
