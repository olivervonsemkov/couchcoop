// Wire protocol between host and guests. Everything is JSON over a single websocket.

/** A display event. Also what gets replayed as history to late joiners. */
export type Ev =
  | { kind: 'chat'; from: string; text: string } // human message, also fed to the agent
  | { kind: 'human'; from: string; text: string } // `//` side-chat, never reaches the model
  | { kind: 'agent'; text: string } // agent output, streamed line by line
  | { kind: 'tool'; text: string } // tool activity ("⚒ Bash: git status")
  | { kind: 'status'; text: string }; // presence, approvals, system notes

export type ClientMsg =
  | { t: 'hello'; token: string; name: string; role?: 'guest' | 'ctl' | 'fork' }
  | { t: 'input'; text: string }
  | { t: 'ctl'; cmd: 'kick' | 'who' | 'stop'; arg?: string }
  | { t: 'fork' };

export type ServerMsg =
  | { t: 'welcome'; history: Ev[]; roster: string[]; host: string }
  | { t: 'ev'; ev: Ev }
  | { t: 'denied'; reason: string }
  | { t: 'kicked' }
  | { t: 'ctlres'; text: string }
  | { t: 'transcript'; jsonl: string; host: string }
  | { t: 'roster'; roster: string[] };

export const DEFAULT_PORT = 4747;
export const HISTORY_LIMIT = 5000;
