import * as net from 'node:net';

/**
 * Inject a user message into a running Claude Code session via its messaging
 * socket (NDJSON: an auth frame, then the message). This is the same channel
 * Claude Code's own cross-session messaging uses.
 */
export function inject(socketPath: string, token: string | undefined, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const sock = net.connect(socketPath, () => {
      if (token) sock.write(JSON.stringify({ type: 'auth', token }) + '\n');
      sock.write(JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n');
      // Give the CLI a beat to read before closing.
      setTimeout(() => {
        sock.end();
        resolve();
      }, 300);
    });
    sock.on('error', reject);
  });
}
