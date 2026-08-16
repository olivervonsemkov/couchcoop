import * as readline from 'node:readline';
import type { Ev } from './protocol.js';
import { bold, cyan, dim, green, nameColor } from './util.js';

/**
 * Line-based terminal UI shared by host and guest: prints events above the
 * readline prompt and redraws the prompt afterwards.
 */
export class UI {
  /** Set after welcome so guest chat can be styled differently from the host's. */
  hostName: string | null = null;

  constructor(private rl: readline.Interface) {}

  print(line: string): void {
    if (process.stdout.isTTY) {
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 0);
    }
    process.stdout.write(line + '\n');
    this.rl.prompt(true);
  }

  event(ev: Ev): void {
    this.print(this.render(ev));
  }

  render(ev: Ev): string {
    switch (ev.kind) {
      case 'chat': {
        const name = nameColor(ev.from)(bold(ev.from));
        // Guest messages render green — mirrors how the host sees them in claude
        // (injected as bash comments, which Claude Code highlights green).
        const text = this.hostName !== null && ev.from !== this.hostName ? green(ev.text) : ev.text;
        return `${name} ${dim('›')} ${text}`;
      }
      case 'human':
        return dim(`// ${ev.from}: ${ev.text}`);
      case 'agent':
        return ev.text;
      case 'tool':
        return cyan(dim(`  ${ev.text}`));
      case 'status':
        return dim(`● ${ev.text}`);
    }
  }
}
