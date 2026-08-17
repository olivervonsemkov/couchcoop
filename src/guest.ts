import * as readline from 'node:readline';
import { WebSocket } from 'ws';
import { center, clip, frame, innerWidth, kv, logoRows, termWidth, tips, twoCol, width } from './box.js';
import type { ClientMsg, ServerMsg } from './protocol.js';
import { formatRoster, UI } from './ui.js';
import { bold, clay, muted, rust, sage, tan, VERSION } from './util.js';

export interface GuestOptions {
  target: string; // host[:port][#token], with optional ws:// prefix
  name: string;
  /** Room password (--pass). Takes precedence over a #token in the target. */
  pass?: string;
}

export function parseTarget(target: string): { url: string; token: string } | null {
  const m = target.match(/^(?:ws:\/\/)?([^#/\s]+?)(?:#(.+))?$/);
  if (!m) return null;
  const hostPort = m[1].includes(':') ? m[1] : `${m[1]}:4747`;
  return { url: `ws://${hostPort}`, token: m[2] ?? '' };
}

const HINTS: [string, string][] = [
  ['⏎', 'talk to claude and the room'],
  ['//', 'humans only'],
  ['/leave', 'exit'],
];

/**
 * The join screen: who you are, whose session you're in, and what the two
 * non-obvious keys do — laid out beside the couch.
 */
function welcomePanel(host: string, self: string, roster: string[], project?: string): string[] {
  const w = termWidth();
  const inner = innerWidth(w);

  const left = [sage(bold(`welcome, ${self}`)), '', ...logoRows()];
  const leftWidth = Math.max(...left.map(width), 16);

  const details: [string, string][] = [['room', formatRoster(roster, host, self)]];
  if (project) details.push(['project', tan(project)]);
  details.push(['tools', muted('run on ') + clay(host) + muted("'s machine")]);

  const right = [
    muted("you're in ") + clay(bold(host)) + muted("'s session"),
    '',
    ...kv(details, 7),
    '',
    muted('everything you type goes to claude and to everyone here'),
  ];

  return frame([['', ...twoCol(left.map((r) => center(r, leftWidth)), right, leftWidth, inner), ''], tips(HINTS, inner)], {
    title: `couchcoop${VERSION ? ` v${VERSION}` : ''}`,
    width: w,
  });
}

export async function runGuest(opts: GuestOptions): Promise<void> {
  const parsed = parseTarget(opts.target);
  if (!parsed) {
    console.error(rust(`invalid target "${opts.target}" — expected host:port#token`));
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: `${sage('❯')} ` });
  const ui = new UI(rl);
  ui.selfName = opts.name;
  const ws = new WebSocket(parsed.url);
  const send = (msg: ClientMsg) => ws.send(JSON.stringify(msg));

  ws.on('open', () => {
    send({ t: 'hello', token: opts.pass ?? parsed.token, name: opts.name });
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
        ui.showWelcome(welcomePanel(msg.host, self, msg.roster, msg.project));
        if (msg.history.length > 0) {
          ui.rule(`history · ${msg.history.length} events`);
          for (const ev of msg.history) ui.event(ev);
          ui.print('');
          ui.rule('live');
        }
        rl.prompt();
        break;
      }
      case 'ev':
        ui.event(msg.ev);
        break;
      case 'roster': {
        // Live presence in the prompt: who else is in the room with you
        const others = msg.roster.filter((n) => n !== ui.selfName);
        const label = others.length > 0 ? `${muted(clip(`👥 ${others.join(' ')}`, 28))} ` : '';
        rl.setPrompt(`${label}${sage('❯')} `);
        rl.prompt(true);
        break;
      }
      case 'denied':
        ui.print(rust(`join denied: ${msg.reason}`));
        process.exit(1);
        break;
      case 'kicked':
        ui.print(rust('you were removed from the session'));
        process.exit(0);
    }
  });

  ws.on('close', () => {
    ui.rule('disconnected · session over');
    process.exit(0);
  });
  ws.on('error', (err) => {
    ui.print(rust(`connection failed: ${err.message}`));
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
      for (const line of tips(HINTS, innerWidth())) ui.print(`  ${line}`);
      return;
    }
    ui.eraseInput(); // the broadcast echo renders it under our own header instead
    send({ t: 'input', text });
    rl.prompt();
  });
  rl.on('SIGINT', () => ws.close());
  rl.on('close', () => ws.close()); // Ctrl+D / stdin ended
}
