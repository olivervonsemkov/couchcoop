import * as readline from 'node:readline';
import { WebSocket } from 'ws';
import type { ClientMsg, ServerMsg } from './protocol.js';
import { UI } from './ui.js';
import { bold, dim, green, red } from './util.js';

export interface GuestOptions {
  target: string; // host:port#token, with optional ws:// prefix
  name: string;
}

export function parseTarget(target: string): { url: string; token: string } | null {
  const m = target.match(/^(?:ws:\/\/)?([^#/\s]+?)(?:#(.+))?$/);
  if (!m) return null;
  const hostPort = m[1].includes(':') ? m[1] : `${m[1]}:4747`;
  return { url: `ws://${hostPort}`, token: m[2] ?? '' };
}

export async function runGuest(opts: GuestOptions): Promise<void> {
  const parsed = parseTarget(opts.target);
  if (!parsed) {
    console.error(red(`invalid target "${opts.target}" — expected host:port#token`));
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '❯ ' });
  const ui = new UI(rl);
  ui.selfName = opts.name;
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
      case 'welcome': {
        ui.hostName = msg.host;
        // Their name may have been deduped server-side (e.g. johan -> johan-2)
        const self = msg.roster.find((n) => n === opts.name || n.startsWith(`${opts.name}-`)) ?? opts.name;
        ui.selfName = self;
        ui.print('');
        ui.print(`  ${bold('couchcoop')} ${dim('·')} ${bold(msg.host)}${dim("'s session")}`);
        ui.print(dim(`  du är ${self} · i rummet: ${msg.roster.join(', ')} · tools kör hos ${msg.host}`));
        ui.print(dim(`  skriv = till agenten · "// text" = bara människor · /leave = lämna`));
        if (msg.history.length > 0) {
          ui.print(dim(`  ── historik (${msg.history.length} händelser) ──`));
          for (const ev of msg.history) ui.event(ev);
          ui.print('');
          ui.print(dim('  ── live ──'));
        }
        rl.prompt();
        break;
      }
      case 'ev':
        ui.event(msg.ev);
        break;
      case 'roster': {
        // Live presence in the prompt: 👥 everyone else in the room
        const others = msg.roster.filter((n) => n !== ui.selfName);
        rl.setPrompt(`${green(`👥 ${others.join(', ')}`)} ${dim('❯')} `);
        rl.prompt(true);
        break;
      }
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
    ui.eraseInput(); // the broadcast echo renders it under our own header instead
    send({ t: 'input', text });
    rl.prompt();
  });
  rl.on('SIGINT', () => ws.close());
  rl.on('close', () => ws.close()); // Ctrl+D / stdin ended
}
