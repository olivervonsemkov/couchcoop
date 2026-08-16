#!/usr/bin/env node
// Wire `copair statusline` into the user's Claude Code statusline.
// - No statusline configured: point it at `copair statusline` (shows guests, else empty).
// - Existing statusline: wrap it in a script that appends the copair segment.
// Idempotent: skips if copair is already wired in.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const claudeDir = path.join(os.homedir(), '.claude');
const settingsPath = path.join(claudeDir, 'settings.json');
const wrapperPath = path.join(claudeDir, 'copair-statusline.sh');

let settings = {};
try {
  settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
} catch {
  // missing or invalid — start fresh
}

const current = settings.statusLine?.command ?? '';

if (current.includes('copair')) {
  console.log('  statusline: already wired to copair');
  process.exit(0);
}

// If the current command is a script that already calls copair, skip too.
const scriptRef = current.match(/(?:bash|sh)\s+(\S+)/)?.[1] ?? (current.startsWith('/') ? current.split(' ')[0] : null);
if (scriptRef) {
  try {
    if (fs.readFileSync(scriptRef, 'utf8').includes('copair statusline')) {
      console.log('  statusline: already wired to copair');
      process.exit(0);
    }
  } catch {
    // unreadable — fall through and wrap
  }
}

let wrapper;
if (current) {
  wrapper = `#!/bin/sh
# copair statusline wrapper — runs your original statusline, appends 👥 guests when sharing.
input=$(cat)
out=$(printf '%s' "$input" | ${current})
p=$(copair statusline 2>/dev/null)
if [ -n "$p" ]; then printf '%s \\033[1;32m%s\\033[0m\\n' "$out" "$p"; else printf '%s\\n' "$out"; fi
`;
} else {
  wrapper = `#!/bin/sh
# copair statusline — shows 👥 connected guests while sharing a session, else nothing.
cat > /dev/null
copair statusline 2>/dev/null
`;
}

fs.mkdirSync(claudeDir, { recursive: true });
fs.writeFileSync(wrapperPath, wrapper, { mode: 0o755 });
settings.statusLine = { type: 'command', command: `sh ${wrapperPath}` };
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
console.log(`  statusline: wired (${current ? 'wrapped existing' : 'installed new'}) → ${wrapperPath}`);
