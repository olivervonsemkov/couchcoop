import * as path from 'node:path';
import * as readline from 'node:readline';
import { query, type SDKMessage, type SDKUserMessage, type PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import { center, frame, innerWidth, kv, logoRows, termWidth, tips, twoCol, width } from './box.js';
import { Room } from './room.js';
import { formatRoster, UI } from './ui.js';
import type { Ev } from './protocol.js';
import {
  amber,
  bold,
  clay,
  cream,
  genToken,
  lanAddresses,
  muted,
  rust,
  sage,
  summarizeInput,
  tan,
  VERSION,
} from './util.js';

export interface HostOptions {
  name: string;
  port: number;
  yolo: boolean;
}

const ROOM_NOTE = (host: string) =>
  `This is a couchcoop multiplayer session: several humans share this one conversation. ` +
  `Every human message is prefixed with the speaker's name in brackets, e.g. "[johan] looks good". ` +
  `Address people by name when it helps. The host is ${host}; all tools run on the host's machine. ` +
  `You may be told when people join or leave the room.`;

const HINTS: [string, string][] = [
  ['/invite', 'address'],
  ['/who', 'room'],
  ['/kick', '<name>'],
  ['//', 'humans only'],
  ['/quit', 'exit'],
];

export async function runHost(opts: HostOptions): Promise<void> {
  const token = genToken();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: `${clay('❯')} ` });
  const ui = new UI(rl);
  ui.hostName = opts.name;

  // ---- input queue feeding the agent loop ----
  const queue: string[] = [];
  let wake: (() => void) | null = null;
  let closed = false;
  const enqueue = (text: string) => {
    queue.push(text);
    wake?.();
  };
  async function* inputStream(): AsyncGenerator<SDKUserMessage> {
    while (!closed) {
      while (queue.length > 0) {
        yield {
          type: 'user',
          message: { role: 'user', content: queue.shift()! },
          parent_tool_use_id: null,
        } as SDKUserMessage;
      }
      await new Promise<void>((r) => (wake = r));
      wake = null;
    }
  }

  // ---- room ----
  const emit = (ev: Ev) => {
    room.broadcast(ev);
    ui.event(ev);
  };
  const room: Room = new Room(opts.port, token, opts.name, {
    onJoin: (name) => emit({ kind: 'status', text: `${name} joined` }),
    onLeave: (name) => emit({ kind: 'status', text: `${name} left` }),
    onInput: (name, text) => handleHumanLine(name, text),
  }, path.basename(process.cwd()));

  // ---- permission prompts (answered by the host only) ----
  let pendingPerm: { resolve: (r: PermissionResult) => void } | null = null;

  const canUseTool = async (
    toolName: string,
    input: Record<string, unknown>,
    info: { title?: string },
  ): Promise<PermissionResult> => {
    const what = info.title ?? `${toolName} ${summarizeInput(input)}`;
    room.broadcast({ kind: 'status', text: `⏳ ${what} — waiting for ${opts.name} to approve` });
    ui.print('');
    ui.print(`  ${amber('⏳')} ${cream(what)}`);
    ui.print(`     ${muted('allow?')} ${tan('y')}${muted(' / ')}${tan('n')}`);
    return new Promise<PermissionResult>((resolve) => {
      pendingPerm = {
        resolve: (r) => {
          pendingPerm = null;
          room.broadcast({
            kind: 'status',
            text: r.behavior === 'allow' ? `✓ ${opts.name} approved ${toolName}` : `✗ ${opts.name} denied ${toolName}`,
          });
          resolve(r);
        },
      };
      rl.prompt(true);
    });
  };

  // ---- human input (host terminal + guests) ----
  function handleHumanLine(name: string, raw: string): void {
    const text = raw.trim();
    if (text.startsWith('//')) {
      emit({ kind: 'human', from: name, text: text.slice(2).trim() });
      return;
    }
    emit({ kind: 'chat', from: name, text });
    enqueue(`[${name}] ${text}`);
  }

  function handleHostLine(raw: string): void {
    const text = raw.trim();
    if (pendingPerm) {
      const yes = /^y(es)?$/i.test(text);
      pendingPerm.resolve(
        yes ? { behavior: 'allow' } : { behavior: 'deny', message: `${opts.name} denied this in couchcoop` },
      );
      return;
    }
    if (!text) {
      rl.prompt();
      return;
    }
    if (text === '/invite') {
      ui.print('');
      for (const line of inviteRows()) ui.print(`  ${line}`);
      ui.print('');
      return;
    }
    if (text === '/who') {
      ui.print(`  ${muted('in the room ·')} ${formatRoster(room.roster(), opts.name, opts.name)}`);
      return;
    }
    if (text.startsWith('/kick ')) {
      const who = text.slice(6).trim();
      if (room.kick(who)) emit({ kind: 'status', text: `${who} was kicked by ${opts.name}` });
      else ui.print(`  ${rust('✗')} ${muted(`no guest named "${who}"`)}`);
      return;
    }
    if (text === '/quit' || text === '/exit') return shutdown();
    if (text === '/help') {
      for (const line of tips(HINTS, innerWidth())) ui.print(`  ${line}`);
      return;
    }
    handleHumanLine(opts.name, text);
  }

  /** The invite block: one join command per reachable address. */
  function inviteRows(): string[] {
    const addrs = lanAddresses();
    if (addrs.length === 0) return [rust('no network address found — are you online?')];
    const rows = [muted('send a teammate one of these')];
    for (const ip of addrs) rows.push('', `  ${cream(`couchcoop join ${ip}:${opts.port}#${token}`)}`);
    return rows;
  }

  /** Solo-mode start screen. */
  function startPanel(): string[] {
    const w = termWidth();
    const inner = innerWidth(w);
    const left = [sage(bold('hosting')), '', ...logoRows()];
    const leftWidth = Math.max(...left.map(width), 16);
    const right = [
      muted('a shared session, with its own agent'),
      '',
      ...kv(
        [
          ['you', clay(bold(opts.name)) + muted(' (host)')],
          ['project', tan(path.basename(process.cwd()))],
          ['port', tan(String(opts.port))],
          ['tools', opts.yolo ? amber('run here without asking (--yolo)') : muted('run here, you approve them')],
        ],
        8,
      ),
    ];
    return frame(
      [
        ['', ...twoCol(left.map((r) => center(r, leftWidth)), right, leftWidth, inner), ''],
        inviteRows(),
        tips(HINTS, inner),
      ],
      { title: `couchcoop${VERSION ? ` v${VERSION}` : ''}`, width: w },
    );
  }

  rl.on('line', handleHostLine);
  rl.on('SIGINT', shutdown);

  function shutdown(): void {
    if (closed) return;
    closed = true;
    room.broadcast({ kind: 'status', text: 'host closed the session' });
    room.close();
    rl.close();
    wake?.();
    q.close();
    process.exit(0);
  }

  // ---- the agent ----
  const q = query({
    prompt: inputStream(),
    options: {
      cwd: process.cwd(),
      includePartialMessages: true,
      permissionMode: opts.yolo ? 'bypassPermissions' : 'default',
      ...(opts.yolo ? {} : { canUseTool }),
      systemPrompt: { type: 'preset', preset: 'claude_code', append: ROOM_NOTE(opts.name) },
    },
  });

  // Agent text arrives as deltas; emit complete lines so guests render cleanly.
  let agentBuf = '';
  const flushAgentLines = (force = false) => {
    let idx: number;
    while ((idx = agentBuf.indexOf('\n')) >= 0) {
      const line = agentBuf.slice(0, idx);
      agentBuf = agentBuf.slice(idx + 1);
      emit({ kind: 'agent', text: line });
    }
    if (force && agentBuf.trim()) {
      emit({ kind: 'agent', text: agentBuf });
      agentBuf = '';
    }
  };

  function handleAgentMessage(m: SDKMessage): void {
    if (m.type === 'system' && m.subtype === 'init') {
      ui.print(`  ${muted(`session ${m.session_id.slice(0, 8)} · model ${m.model}`)}`);
      return;
    }
    if (m.type === 'stream_event' && m.parent_tool_use_id === null) {
      const ev = m.event;
      if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
        agentBuf += ev.delta.text;
        flushAgentLines();
      } else if (ev.type === 'content_block_stop' || ev.type === 'message_stop') {
        flushAgentLines(true);
      }
      return;
    }
    if (m.type === 'assistant' && m.parent_tool_use_id === null) {
      flushAgentLines(true);
      for (const block of m.message.content) {
        if (block.type === 'tool_use') {
          emit({ kind: 'tool', text: `⚒ ${block.name} ${summarizeInput(block.input as Record<string, unknown>)}` });
        }
      }
      return;
    }
    if (m.type === 'result') {
      flushAgentLines(true);
      if (m.subtype !== 'success') emit({ kind: 'status', text: `agent error: ${m.subtype}` });
      rl.prompt(true);
    }
  }

  // ---- banner ----
  ui.showWelcome(startPanel());
  rl.prompt();

  try {
    for await (const m of q) handleAgentMessage(m);
  } catch (err) {
    ui.print(`  ${rust('✗')} agent loop crashed: ${err instanceof Error ? err.message : String(err)}`);
  }
  shutdown();
}

