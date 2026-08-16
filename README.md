# copair

> Multiplayer for Claude Code. Invite a teammate into your live session — without leaving it.

Stuck? Want a second pair of eyes? Skip the PR-and-a-novel-of-context. Run `/copair-invite`, drop the command in Slack, and your teammate is *in your session* — full history, live agent output, a prompt of their own. Tools run on your machine, under your permissions. You never leave `claude`.

No accounts. No server. No cloud. Works over the same wifi or any shared VPN.

```
  you (in claude)                     teammate
┌───────────────────────────┐
│ > /copair-invite          │
│ → copair join 192.168.1.24│─── Slack ───┐
│                           │             ▼
│ 👥 johan                  │◄── ✓ joined your session
│                           │
│ [johan]: is auth green?   │  👥 oliver ❯ is auth green?
│ claude: diff looks ok,    │  ✦ claude
│   but retry is missing…   │    diff looks ok, but retry…
└───────────────────────────┘
```

## Install

```sh
git clone https://github.com/olivervonsemkov/copair
cd copair && ./install.sh
```

Node 18+. Installs the `copair` command, the `/copair-*` slash commands, and statusline presence.

## Use

**Host** — in your normal `claude` session:

```
/copair-invite
```

**Teammate** — same wifi or VPN:

```sh
copair join 192.168.1.24 --name johan   # live, in the host's session
copair fork 192.168.1.24                # or: copy it into your own claude
```

That's it.

| | |
|---|---|
| `join` | shared room — talk to each other and to the host's agent, live |
| `fork` | full session copied to your machine, opened in *your* claude (`--resume`) |
| `// text` | humans-only chat, the agent never sees it |
| `👥 johan` | presence — statusline for the host, prompt for guests |
| `/copair-who` `-kick` `-stop` | manage the room |

Guests approve nothing: permission prompts stay with the host, always.

## How it works

A tiny sidecar next to your running `claude`:

- **out** — tails your session transcript, streams it to guests over its own websocket
- **in** — delivers guest messages through Claude Code's local messaging socket, prefixed `[name]:`
- **open by default** — anyone who can reach the port can join; `copair attach --token` requires an invite code

Your session stays a completely normal Claude Code session — same UI, same transcript, resumable as always. There's also `copair --solo` (standalone shared session via the Agent SDK) if you can't run the sidecar.

## Security

Sharing a session means sharing it: guests see the transcript (including file contents and command output that passed through) and can prompt an agent with tool access to your machine — your permission prompts are the boundary. The websocket is plain `ws://`. Use on networks you trust, or lock the room with `--token`.

## License

MIT
