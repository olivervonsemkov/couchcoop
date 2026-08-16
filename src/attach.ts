import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Room } from './room.js';
import { inject } from './inject.js';
import { findTranscript, lineToEvents, Tail } from './transcript.js';
import type { Ev } from './protocol.js';
import { genToken, lanAddresses } from './util.js';

export interface AttachOptions {
  name: string;
  port: number;
  /** Require an invite token. Default is open mode: anyone on the network can join. */
  withToken?: boolean;
}

export function stateFile(port: number): string {
  return path.join(os.tmpdir(), `copair-${port}.json`);
}

/**
 * Sidecar mode: the host keeps sitting in their normal interactive `claude`.
 * This daemon serves guests over websocket, streams the session transcript
 * out to them, and injects their messages into the running session via
 * Claude Code's messaging socket.
 */
export async function runAttach(opts: AttachOptions): Promise<void> {
  const socketPath = process.env.CLAUDE_CODE_MESSAGING_SOCKET;
  const msgToken = process.env.CLAUDE_CODE_MESSAGING_TOKEN;
  if (!socketPath || !msgToken) {
    console.error(
      'copair attach must run from inside a Claude Code session (CLAUDE_CODE_MESSAGING_SOCKET is not set).\n' +
        'Ask Claude to run it via Bash, or use `copair --solo` to host standalone.',
    );
    process.exit(1);
  }

  const transcript = findTranscript(process.cwd());
  if (!transcript) {
    console.error(`no session transcript found for ${process.cwd()} — has the session said anything yet?`);
    process.exit(1);
  }

  const token = opts.withToken ? genToken() : '';
  const guestNames = new Set<string>();

  const isGuestEcho = (text: string) => {
    const m = text.match(/^\[([^\]]+)\]/);
    return m !== null && guestNames.has(m[1]);
  };

  const log = (s: string) => console.log(s);

  const room: Room = new Room(opts.port, token, opts.name, {
    // Presence is NOT injected into the session — each injection triggers a noisy
    // banner + an agent turn. Guests see it via broadcast; the host via statusline/ctl who.
    onJoin: (name) => {
      guestNames.add(name);
      room.broadcast({ kind: 'status', text: `${name} joined` });
      writeState();
      log(`+ ${name} joined`);
    },
    onLeave: (name) => {
      room.broadcast({ kind: 'status', text: `${name} left` });
      writeState();
      log(`- ${name} left`);
    },
    onInput: (name, raw) => {
      const text = raw.trim();
      if (text.startsWith('//')) {
        room.broadcast({ kind: 'human', from: name, text: text.slice(2).trim() });
        return;
      }
      room.broadcast({ kind: 'chat', from: name, text });
      inject(socketPath, msgToken, `[${name}]: ${text}`).catch((err) => {
        log(`✗ inject failed (${err.message}) — was the claude session restarted? Restart copair attach.`);
        room.broadcast({ kind: 'status', text: `could not deliver to host session: ${err.message}` });
      });
    },
    onCtl: (cmd, arg) => {
      if (cmd === 'who') return `in the room: ${room.roster().join(', ')}`;
      if (cmd === 'kick' && arg) {
        if (room.kick(arg)) {
          room.broadcast({ kind: 'status', text: `${arg} was kicked by ${opts.name}` });
          return `kicked ${arg}`;
        }
        return `no guest named "${arg}"`;
      }
      if (cmd === 'stop') {
        setTimeout(() => shutdown(), 100);
        return 'stopping';
      }
      return 'unknown command';
    },
    onFork: () => {
      try {
        log(`↥ transcript forked by a guest`);
        return fs.readFileSync(transcript, 'utf8');
      } catch {
        return null;
      }
    },
  });

  // Seed history from the existing transcript so late joiners get context,
  // then follow it live.
  const tail = new Tail(transcript, true, (json) => {
    for (const ev of lineToEvents(json, opts.name, isGuestEcho)) {
      if (isInternalNote(ev)) continue;
      room.broadcast(ev);
    }
  });

  function writeState(): void {
    try {
      fs.writeFileSync(stateFile(opts.port), JSON.stringify({ port: opts.port, token, pid: process.pid, roster: room.roster() }));
    } catch {
      // best effort — ctl and statusline just won't see us
    }
  }

  function shutdown(): void {
    tail.close();
    room.broadcast({ kind: 'status', text: 'host closed the session' });
    room.close();
    try {
      fs.unlinkSync(stateFile(opts.port));
    } catch {}
    process.exit(0);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  writeState();
  const addrs = lanAddresses();
  const suffix = (ip: string) =>
    `${ip}${opts.port === 4747 ? '' : `:${opts.port}`}${token ? `#${token}` : ''}`;
  log(`copair attached to session (transcript: ${path.basename(transcript)})`);
  log(`invite (same wifi or VPN):`);
  for (const ip of addrs) log(`  copair join ${suffix(ip)} --name <deras-namn>`);
  if (!token) log(`open mode: anyone on the network can join — use --token to require a code`);
  log(`manage: copair ctl who|kick <name>|stop --port ${opts.port}`);
}

/** Skip our own [copair] join/leave notes when they echo back through the transcript. */
function isInternalNote(ev: Ev): boolean {
  return ev.kind === 'chat' && (ev.from === 'copair' || ev.text.startsWith('[copair]'));
}
