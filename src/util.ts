import { randomBytes } from 'node:crypto';
import { networkInterfaces, userInfo } from 'node:os';

export function genToken(): string {
  return randomBytes(4).toString('base64url');
}

export function defaultName(): string {
  try {
    return userInfo().username || 'host';
  } catch {
    return 'host';
  }
}

/** All reachable IPv4 addresses, private/VPN ranges first. */
export function lanAddresses(): string[] {
  const out: string[] = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) out.push(a.address);
    }
  }
  const rank = (ip: string) =>
    ip.startsWith('100.') ? 0 : ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.') ? 1 : 2;
  return out.sort((x, y) => rank(x) - rank(y));
}

// --- tiny ANSI helpers (respect NO_COLOR) ---
const on = !process.env.NO_COLOR && process.stdout.isTTY !== false;
const wrap = (code: string) => (s: string) => (on ? `\x1b[${code}m${s}\x1b[0m` : s);

export const dim = wrap('2');
export const bold = wrap('1');
export const green = wrap('32');
export const yellow = wrap('33');
export const red = wrap('31');
export const cyan = wrap('36');
export const magenta = wrap('35');

const NAME_COLORS = ['35', '33', '36', '32', '34', '95', '93', '96'];

/** Stable color per participant name. */
export function nameColor(name: string): (s: string) => string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return wrap(NAME_COLORS[h % NAME_COLORS.length]);
}

/** One-line summary of a tool call's input, for display. */
export function summarizeInput(input: Record<string, unknown>): string {
  const pick =
    (input.command as string) ??
    (input.file_path as string) ??
    (input.path as string) ??
    (input.pattern as string) ??
    (input.url as string) ??
    (input.description as string) ??
    JSON.stringify(input);
  const s = String(pick ?? '').replace(/\s+/g, ' ');
  return s.length > 80 ? s.slice(0, 77) + '…' : s;
}
