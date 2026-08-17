// Framed-panel rendering for the start screens: ANSI-aware measurement,
// padding, two-column layout, and the couch itself.
import { bold, clay, cream, muted, rail, tan } from './util.js';

const ANSI_RE = /\x1b\[[0-9;]*m/g;

/** Frame width for the current terminal, clamped to a readable range. */
export function termWidth(): number {
  const cols = process.stdout.columns || 80;
  return Math.max(46, Math.min(cols - 2, 78));
}

/** Content width inside a frame's borders and padding. */
export function innerWidth(w: number = termWidth()): number {
  return w - 4;
}

// Enough of the East Asian Wide / emoji ranges for what we render.
function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1faff)
  );
}

/** Visible width: ANSI codes stripped, emoji counted double. */
export function width(s: string): number {
  let n = 0;
  for (const ch of s.replace(ANSI_RE, '')) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0xfe0f) continue; // variation selector
    n += isWide(cp) ? 2 : 1;
  }
  return n;
}

function pad(s: string, w: number): string {
  return s + ' '.repeat(Math.max(0, w - width(s)));
}

/** Center within `w` visible columns. */
export function center(s: string, w: number): string {
  const gap = Math.max(0, w - width(s));
  const left = Math.floor(gap / 2);
  return ' '.repeat(left) + s + ' '.repeat(gap - left);
}

/** Truncate to `max` visible columns with an ellipsis, keeping ANSI codes intact. */
export function clip(s: string, max: number): string {
  if (width(s) <= max) return s;
  let out = '';
  let w = 0;
  for (let i = 0; i < s.length; ) {
    if (s[i] === '\x1b') {
      const m = /^\x1b\[[0-9;]*m/.exec(s.slice(i));
      if (m) {
        out += m[0];
        i += m[0].length;
        continue;
      }
    }
    const ch = String.fromCodePoint(s.codePointAt(i)!);
    const cw = width(ch);
    if (w + cw > max - 1) break;
    out += ch;
    w += cw;
    i += ch.length;
  }
  return out + '…';
}

/** Aligned label/value rows: muted label column of fixed width, then the value. */
export function kv(pairs: [string, string][], labelWidth: number): string[] {
  return pairs.map(([k, v]) => muted(pad(k, labelWidth)) + ' ' + v);
}

/** Zip two columns into rows; the left column is padded to a fixed width. */
export function twoCol(left: string[], right: string[], leftWidth: number, inner: number): string[] {
  const rows = Math.max(left.length, right.length);
  const out: string[] = [];
  for (let i = 0; i < rows; i++) {
    out.push(clip(pad(left[i] ?? '', leftWidth) + '   ' + (right[i] ?? ''), inner));
  }
  return out;
}

/** Key hints as wrapped `key desc  ·  key desc` lines. */
export function tips(hints: [string, string][], inner: number = innerWidth()): string[] {
  const sep = muted('  ·  ');
  const sepW = 5;
  const lines: string[] = [];
  let line = '';
  let w = 0;
  for (const [k, d] of hints) {
    const chip = `${tan(k)} ${muted(d)}`;
    const cw = width(chip);
    if (line && w + sepW + cw > inner) {
      lines.push(line);
      line = chip;
      w = cw;
    } else if (line) {
      line += sep + chip;
      w += sepW + cw;
    } else {
      line = chip;
      w = cw;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** `── label ──────` section break at the given width. */
export function rule(w: number, label?: string): string {
  if (!label) return rail('─'.repeat(Math.max(0, w)));
  const fill = Math.max(0, w - width(label) - 4);
  return rail('── ') + muted(label) + rail(' ' + '─'.repeat(fill));
}

/**
 * Draw a rounded box around the given sections, separated by dividers:
 *   ╭─ title ────╮
 *   │ section 1  │
 *   ├────────────┤
 *   │ section 2  │
 *   ╰────────────╯
 */
export function frame(sections: string[][], opts: { title?: string; width?: number } = {}): string[] {
  const w = opts.width ?? termWidth();
  const inner = innerWidth(w);
  const out: string[] = [];
  if (opts.title) {
    const fill = Math.max(0, w - width(opts.title) - 5);
    out.push(rail('╭─ ') + cream(bold(opts.title)) + rail(' ' + '─'.repeat(fill) + '╮'));
  } else {
    out.push(rail('╭' + '─'.repeat(w - 2) + '╮'));
  }
  const body = sections.filter((s) => s.length > 0);
  body.forEach((section, i) => {
    if (i > 0) out.push(rail('├' + '─'.repeat(w - 2) + '┤'));
    for (const s of section) out.push(rail('│ ') + pad(clip(s, inner), inner) + rail(' │'));
  });
  out.push(rail('╰' + '─'.repeat(w - 2) + '╯'));
  return out;
}

/** The couch. Every row is 15 columns so centering shifts them together. */
export function logoRows(): string[] {
  const cushion = clay('▚▚▚');
  return [
    tan(' ╭───────────╮ '),
    tan('╭┤ ') + cushion + tan(' │ ') + cushion + tan(' ├╮'),
    tan('│╰─────┴─────╯│'),
    tan('╰─┬─────────┬─╯'),
    rail('  ╵         ╵  '),
  ];
}
