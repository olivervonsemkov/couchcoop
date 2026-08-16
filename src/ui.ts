import * as readline from 'node:readline';
import type { Ev } from './protocol.js';
import { bold, cyan, dim, nameColor } from './util.js';

/**
 * Line-based terminal UI shared by host and guest: prints events above the
 * readline prompt and redraws the prompt afterwards.
 */
export class UI {
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
    this.print(renderEvent(ev));
  }
}

export function renderEvent(ev: Ev): string {
  switch (ev.kind) {
    case 'chat':
      return `${nameColor(ev.from)(bold(ev.from))}: ${ev.text}`;
    case 'human':
      return dim(`// ${ev.from}: ${ev.text}`);
    case 'agent':
      return ev.text;
    case 'tool':
      return cyan(dim(ev.text));
    case 'status':
      return dim(`● ${ev.text}`);
  }
}
