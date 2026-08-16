<div align="center">

# couchcoop

**Couch co-op for Claude Code — let others join your session.**

<img src="assets/banner.jpg" alt="couchcoop — couch co-op for Claude Code" width="100%">

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

</div>

---

Your session, but multiplayer. A teammate joins from their own terminal and sees everything you and Claude are doing — the history, the live output, all of it. They can talk to you, and they can talk to your Claude. It's still your session: your machine, your permissions, your transcript. You never leave `claude`.

No accounts. No server. No cloud. Same wifi or shared VPN is all it takes.

```
you — in claude, as usual
┌───────────────────────────────────┐
│ > /couchcoop-invite               │
│ ⎿ couchcoop join 192.168.1.24     │── send the address ──┐
│                                   │                      │
│                                   │   teammate — any terminal
│                                   │   ┌─────────────────▼─────────────────┐
│                                   │   │ $ couchcoop join 192.168.1.24     │
│                                   │   │ ✓ joined — full history replayed  │
│ [sam]: is auth green?             │◀──│ 👥 alex ❯ is auth green?          │
│ ✦ diff looks ok, but retry        │──▶│ ✦ claude                          │
│   is missing on line 84…          │   │   diff looks ok, but retry…       │
│ 👥 sam                  ctx:87%   │   │ 👥 alex ❯ _                       │
└───────────────────────────────────┘   └───────────────────────────────────┘
       tools run only here                    sees everything, live
```

Why? Because "am I on the right track?" shouldn't cost a PR and a novel of context. Your session already *is* the context — so let them in.

## Install

```sh
git clone https://github.com/olivervonsemkov/couchcoop
cd couchcoop && ./install.sh
```

Node 18+. Installs the `couchcoop` command, the `/couchcoop-*` slash commands, and statusline presence.

## Use

**You** — in your normal `claude` session:

```
/couchcoop-invite
```

…or `/couchcoop-invite <password>` if you want the room locked — guests then join with `--pass <password>`.

**They** — same wifi or VPN:

```sh
couchcoop join 192.168.1.24 --name sam   # join you live
couchcoop fork 192.168.1.24                # or: take a copy into their own claude
```

That's it.

| | |
|---|---|
| `join` | they're in your session — everyone talks to each other and to your Claude |
| `fork` | they take the whole session home and open it in *their* claude (`--resume`) |
| `// text` | humans-only chat, Claude never sees it |
| `👥 sam` | presence — statusline for you, prompt for them |
| `/couchcoop-who` `-kick` `-stop` | your room, your rules |

Guests approve nothing: permission prompts stay with you, always.

## How it works

When you run `/couchcoop-invite`, a small background process (`couchcoop attach`) starts next to your `claude` and acts as the bridge:

- **outgoing** — Claude Code already writes everything in your session to a transcript file on disk; couchcoop follows that file and streams every new line to your guests over a websocket it serves itself (port `4747`)
- **incoming** — every running `claude` listens on a local messaging socket; couchcoop delivers guest messages through it, so they show up in your session as `[sam]: …` and Claude answers them like any other message
- **access** — open by default: anyone who can reach the port can join. lock the room with `/couchcoop-invite <password>` — guests must then join with `--pass <password>` (`--token` generates a random code instead)

Your session stays a completely normal Claude Code session — same UI, same transcript, resumable as always. There's also `couchcoop --solo` (standalone shared session via the Agent SDK) if you can't run the sidecar.

## Security

Letting someone join means letting them see: the transcript (including file contents and command output that passed through) and a direct line to an agent with tool access on your machine — your permission prompts are the boundary. The websocket is plain `ws://`. Use on networks you trust, or lock the room with a password: `/couchcoop-invite <password>`.

## License

MIT
