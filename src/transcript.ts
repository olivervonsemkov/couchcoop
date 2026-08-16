import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Ev } from './protocol.js';
import { summarizeInput } from './util.js';

/** Claude Code's project-directory slug for a working directory. */
export function projectSlug(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-');
}

/** Most recently modified session transcript for the given working directory. */
export function findTranscript(cwd: string): string | null {
  const dir = path.join(os.homedir(), '.claude', 'projects', projectSlug(cwd));
  let files: string[];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const sessions = files
    .filter((f) => /^[0-9a-f-]{36}\.jsonl$/.test(f))
    .map((f) => {
      const p = path.join(dir, f);
      return { p, mtime: fs.statSync(p).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return sessions[0]?.p ?? null;
}

/**
 * Convert one transcript JSONL line into display events.
 * The format is internal to Claude Code and unstable — parse defensively,
 * ignore anything unrecognized.
 */
export function lineToEvents(json: any, hostName: string, isGuestEcho: (text: string) => boolean): Ev[] {
  if (!json || typeof json !== 'object' || json.isMeta) return [];
  const out: Ev[] = [];

  if (json.type === 'assistant') {
    const content = json.message?.content;
    if (!Array.isArray(content)) return [];
    for (const block of content) {
      if (block?.type === 'text' && typeof block.text === 'string') {
        for (const line of block.text.split('\n')) out.push({ kind: 'agent', text: line });
      } else if (block?.type === 'tool_use') {
        out.push({ kind: 'tool', text: `⚒ ${block.name} ${summarizeInput(block.input ?? {})}` });
      }
    }
    return out;
  }

  if (json.type === 'user') {
    const content = json.message?.content;
    const texts: string[] = [];
    if (typeof content === 'string') texts.push(content);
    else if (Array.isArray(content)) {
      for (const block of content) {
        if (block?.type === 'text' && typeof block.text === 'string') texts.push(block.text);
      }
    }
    for (const text of texts) {
      const t = text.trim();
      if (!t || t.startsWith('<')) continue; // command output / system-reminder wrappers
      if (isGuestEcho(t)) continue; // a guest message we injected, already broadcast
      out.push({ kind: 'chat', from: hostName, text: t });
    }
    return out;
  }

  return [];
}

/**
 * Incremental JSONL tailer: fires onLine for every complete new line.
 * Uses stat polling — cheap, and robust across editors/atomic writes.
 */
export class Tail {
  private offset: number;
  private buf = '';
  private timer: ReturnType<typeof setInterval>;

  constructor(
    private file: string,
    fromStart: boolean,
    private onLine: (json: any) => void,
    intervalMs = 300,
  ) {
    this.offset = fromStart ? 0 : this.size();
    this.timer = setInterval(() => this.poll(), intervalMs);
    if (fromStart) this.poll();
  }

  private size(): number {
    try {
      return fs.statSync(this.file).size;
    } catch {
      return 0;
    }
  }

  private poll(): void {
    const size = this.size();
    if (size <= this.offset) return;
    const stream = fs.createReadStream(this.file, { start: this.offset, end: size - 1, encoding: 'utf8' });
    this.offset = size;
    stream.on('data', (chunk) => (this.buf += chunk));
    stream.on('end', () => {
      let idx: number;
      while ((idx = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, idx);
        this.buf = this.buf.slice(idx + 1);
        if (!line.trim()) continue;
        try {
          this.onLine(JSON.parse(line));
        } catch {
          // partial or non-JSON line — ignore
        }
      }
    });
  }

  close(): void {
    clearInterval(this.timer);
  }
}
