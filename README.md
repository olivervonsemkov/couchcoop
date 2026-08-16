# copair

> **Let others join your Claude Code session.**

Your session, but multiplayer. A teammate joins from their own terminal and sees everything you and Claude are doing — the history, the live output, all of it. They can talk to you, and they can talk to your Claude. It's still your session: your machine, your permissions, your transcript. You never leave `claude`.

No accounts. No server. No cloud. Same wifi or shared VPN is all it takes.

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

Why? Because "am I on the right track?" shouldn't cost a PR and a novel of context. Your session already *is* the context — so let them in.

## Install

```sh
git clone https://github.com/olivervonsemkov/copair
cd copair && ./install.sh
```

Node 18+. Installs the `copair` command, the `/copair-*` slash commands, and statusline presence.

## Use

**You** — in your normal `claude` session:

```
/copair-invite
```

**They** — same wifi or VPN:

```sh
copair join 192.168.1.24 --name johan   # join you live
copair fork 192.168.1.24                # or: take a copy into their own claude
```

That's it.

| | |
|---|---|
| `join` | they're in your session — everyone talks to each other and to your Claude |
| `fork` | they take the whole session home and open it in *their* claude (`--resume`) |
| `// text` | humans-only chat, Claude never sees it |
| `👥 johan` | presence — statusline for you, prompt for them |
| `/copair-who` `-kick` `-stop` | your room, your rules |

Guests approve nothing: permission prompts stay with you, always.

## How it works

A tiny sidecar next to your running `claude`:

- **out** — tails your session transcript, streams it to guests over its own websocket
- **in** — delivers guest messages through Claude Code's local messaging socket, prefixed `[name]:`
- **open by default** — anyone who can reach the port can join; `copair attach --token` requires an invite code

Your session stays a completely normal Claude Code session — same UI, same transcript, resumable as always. There's also `copair --solo` (standalone shared session via the Agent SDK) if you can't run the sidecar.

## Security

Letting someone join means letting them see: the transcript (including file contents and command output that passed through) and a direct line to an agent with tool access on your machine — your permission prompts are the boundary. The websocket is plain `ws://`. Use on networks you trust, or lock the room with `--token`.

## License

MIT
