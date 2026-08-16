import * as fs from 'node:fs';
import { WebSocket } from 'ws';
import { stateFile } from './attach.js';
import type { ServerMsg } from './protocol.js';

/** Send a control command to a local copair attach daemon. */
export async function runCtl(cmd: 'kick' | 'who' | 'stop', arg: string | undefined, port: number): Promise<void> {
  let state: { token: string };
  try {
    state = JSON.parse(fs.readFileSync(stateFile(port), 'utf8'));
  } catch {
    console.error(`no copair daemon found on port ${port} (state file missing)`);
    process.exit(1);
  }

  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  ws.on('open', () => {
    ws.send(JSON.stringify({ t: 'hello', token: state.token, name: '_ctl', role: 'ctl' }));
    ws.send(JSON.stringify({ t: 'ctl', cmd, arg }));
  });
  ws.on('message', (raw) => {
    const msg: ServerMsg = JSON.parse(raw.toString());
    if (msg.t === 'ctlres') {
      console.log(msg.text);
      ws.close();
      process.exit(0);
    }
    if (msg.t === 'denied') {
      console.error(`denied: ${msg.reason}`);
      process.exit(1);
    }
  });
  ws.on('error', (err) => {
    console.error(`could not reach daemon: ${err.message}`);
    process.exit(1);
  });
  setTimeout(() => process.exit(1), 5000);
}
