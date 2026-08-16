import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * Print a compact presence segment for the host's statusline, e.g. "👥 johan, sara".
 * Reads the state files copair attach daemons write; prints nothing when no
 * guests are connected, so it can be appended unconditionally.
 */
export function runStatusline(): void {
  const dir = os.tmpdir();
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => /^copair-\d+\.json$/.test(f));
  } catch {
    return;
  }
  const guests: string[] = [];
  for (const f of files) {
    try {
      const state = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      // roster[0] is the host; a dead daemon's stale file is skipped via pid check
      if (state.pid && !isAlive(state.pid)) continue;
      guests.push(...(state.roster ?? []).slice(1));
    } catch {
      // unreadable state file — skip
    }
  }
  if (guests.length > 0) process.stdout.write(`👥 ${guests.join(', ')}`);
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
