#!/usr/bin/env node
import { runHost } from './host.js';
import { runGuest } from './guest.js';
import { runAttach } from './attach.js';
import { runCtl } from './ctl.js';
import { runFork } from './fork.js';
import { runStatusline } from './statusline.js';
import { DEFAULT_PORT } from './protocol.js';
import { defaultName } from './util.js';

const HELP = `couchcoop — invite a teammate into your live Claude Code session

usage:
  couchcoop attach                    share the claude session you're sitting in
                                   (run via Claude Code's Bash — ask claude to run it)
  couchcoop join <host[:port][#token]>   join someone's session live from your terminal
  couchcoop fork <host[:port][#token]>   copy the session and open it in your own claude
                                      (full scrollable history; you talk to YOUR agent)
  couchcoop ctl who|kick <name>|stop  manage a running attach daemon
  couchcoop --solo                    standalone host mode (own agent loop, no claude UI)

options:
  --name <name>   how you appear to others (default: your OS username)
  --pass <word>   lock the room with a password (host) / supply it (guest)
  --port <port>   port (default: ${DEFAULT_PORT})
  --yolo          solo mode only: skip permission prompts (dangerous)

as a guest:
  /leave          exit the session
  // <text>       chat humans-only — the agent never sees it
`;

function arg(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP);
    return;
  }

  const name = arg(argv, '--name') ?? defaultName();
  const port = Number(arg(argv, '--port') ?? DEFAULT_PORT);
  const pass = arg(argv, '--pass');

  switch (argv[0]) {
    case 'join': {
      const target = argv[1];
      if (!target) {
        console.error('usage: couchcoop join <host:port#token>');
        process.exit(1);
      }
      await runGuest({ target, name, pass });
      return;
    }
    case 'fork': {
      const target = argv[1];
      if (!target) {
        console.error('usage: couchcoop fork <host:port#token>');
        process.exit(1);
      }
      await runFork({ target, launch: !argv.includes('--no-launch'), pass });
      return;
    }
    case 'attach':
      await runAttach({ name, port, withToken: argv.includes('--token'), pass });
      return;
    case 'statusline':
      runStatusline();
      return;
    case 'ctl': {
      const cmd = argv[1];
      if (cmd !== 'who' && cmd !== 'kick' && cmd !== 'stop') {
        console.error('usage: couchcoop ctl who|kick <name>|stop [--port <port>]');
        process.exit(1);
      }
      await runCtl(cmd, cmd === 'kick' ? argv[2] : undefined, port);
      return;
    }
    default: {
      // No subcommand: attach if we're inside a claude session, else solo host.
      if (!argv.includes('--solo') && process.env.CLAUDE_CODE_MESSAGING_SOCKET) {
        await runAttach({ name, port, withToken: argv.includes('--token'), pass });
        return;
      }
      await runHost({
        name,
        port,
        yolo: argv.includes('--yolo') || argv.includes('--dangerously-skip-permissions'),
      });
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
