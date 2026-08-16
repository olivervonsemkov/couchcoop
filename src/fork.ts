import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import { parseTarget } from './guest.js';
import { projectSlug } from './transcript.js';
import type { ServerMsg } from './protocol.js';
import { bold, dim, green, red } from './util.js';

export interface ForkOptions {
  target: string;
  launch: boolean; // false = just write the session file and print the resume command
}

/**
 * Fork mode: fetch the host's full session transcript, install it as a local
 * Claude Code session for the current directory, and open `claude --resume`
 * on it — native UI, full scrollable history, as if you'd been there.
 * It's a copy: from here on you talk to YOUR agent on YOUR machine.
 */
export async function runFork(opts: ForkOptions): Promise<void> {
  const parsed = parseTarget(opts.target);
  if (!parsed) {
    console.error(red(`invalid target "${opts.target}" — expected host:port#token`));
    process.exit(1);
  }

  const ws = new WebSocket(parsed.url, { maxPayload: 512 * 1024 * 1024 });
  ws.on('open', () => {
    ws.send(JSON.stringify({ t: 'hello', token: parsed.token, name: 'fork', role: 'fork' }));
    ws.send(JSON.stringify({ t: 'fork' }));
  });
  ws.on('error', (err) => {
    console.error(red(`connection failed: ${err.message}`));
    process.exit(1);
  });

  ws.on('message', (raw) => {
    let msg: ServerMsg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.t === 'denied') {
      console.error(red(`denied: ${msg.reason}`));
      process.exit(1);
    }
    if (msg.t !== 'transcript') return;
    ws.close();

    const sessionId = randomUUID();
    const cwd = process.cwd();
    const dir = path.join(os.homedir(), '.claude', 'projects', projectSlug(cwd));
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${sessionId}.jsonl`);
    fs.writeFileSync(file, rewriteTranscript(msg.jsonl, sessionId, cwd));

    console.log(bold(`✓ forked ${msg.host}'s session → ${sessionId}`));
    console.log(dim(`  this is a copy: from here on you talk to your own agent, on this machine`));
    if (!opts.launch) {
      console.log(green(`  open it with: claude --resume ${sessionId}`));
      return;
    }
    console.log(dim(`  opening claude…`));
    const child = spawn('claude', ['--resume', sessionId], { stdio: 'inherit', cwd });
    child.on('error', () => {
      console.error(red(`could not launch claude — open it yourself: claude --resume ${sessionId}`));
      process.exit(1);
    });
    child.on('exit', (code) => process.exit(code ?? 0));
  });
}

/** Point every line at the new session id and this machine's cwd, so claude picks it up as a local session. */
function rewriteTranscript(jsonl: string, sessionId: string, cwd: string): string {
  return jsonl
    .split('\n')
    .map((line) => {
      if (!line.trim()) return line;
      try {
        const obj = JSON.parse(line);
        if ('sessionId' in obj) obj.sessionId = sessionId;
        if ('session_id' in obj) obj.session_id = sessionId;
        if ('cwd' in obj) obj.cwd = cwd;
        return JSON.stringify(obj);
      } catch {
        return line;
      }
    })
    .join('\n');
}
