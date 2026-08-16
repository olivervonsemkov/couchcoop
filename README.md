# copair

**Invite a teammate into your live Claude Code session — without leaving it.**

You're pair programming with your agent and you're stuck, or you just want a second pair of eyes. Instead of pushing a PR and writing a novel of context, you ask Claude to invite your colleague. They join from their own terminal: full conversation history, live agent output, and a prompt of their own. Everyone talks to each other and to the agent. Tools run on your machine, under your permissions, and you stay in your normal `claude` the whole time.

No accounts. No server. No cloud. Your machine **is** the server — works over the same wifi or any shared VPN (Tailscale, WireGuard, office VPN).

```
  OLIVER (in claude, as usual)         JOHAN (guest)
┌─────────────────────────────┐
│ > invite johan               │
│ ⚒ copair attach              │
│ → copair join                │
│   192.168.1.24:4747#a8f3     │──── Slack ────┐
│                              │               ▼
│ [copair] johan joined        │◄── ✓ joined oliver's session
│                              │    (sees the whole conversation)
│ [johan] is auth green?       │    johan: is auth green?
│ claude: the diff looks ok,   │    claude: the diff looks ok,
│   but retry is missing…      │      but retry is missing…
└─────────────────────────────┘
```

## Install

Same on every machine (host and guests):

```sh
git clone https://github.com/olivervonsemkov/copair
cd copair && ./install.sh
```

That builds the `copair` command and installs the claude skill. Requires Node 18+.

## Use

**Host:** inside your normal `claude` session, just say *"invite johan"*. Claude starts the sidecar and gives you a join link like `copair join 192.168.1.24:4747#a8f3k2` — send it to your teammate (same wifi or shared VPN).

**Guest — two ways in:**

```sh
copair join 192.168.1.24:4747#a8f3k2 --name johan   # live: sit in the host's session
copair fork 192.168.1.24:4747#a8f3k2                # copy: open it in YOUR claude
```

- **join** — the shared room. You see everything live, and what you type lands in the host's session prefixed `[johan]`; the host's agent answers everyone. `// like this` chats humans-only (the agent never sees it). `/leave` to exit.
- **fork** — "as if you'd been there". The whole session is copied to your machine and opened in your own `claude` with `--resume`: native UI, full scrollable history. From there you talk to *your* agent on *your* machine — best when you have the same repo checked out. Great for "read in and dig on your own" while `join` is for working together live.

Guests approve nothing in either mode: permission prompts stay with the host.

## Managing the room

Ask Claude (or run yourself):

```sh
copair ctl who            # who's in the room
copair ctl kick johan     # remove a guest
copair ctl stop           # stop sharing, disconnect everyone
```

## Presence in your statusline

Joins/leaves are deliberately not announced inside the session (each announcement would trigger a noisy banner and an agent turn). Instead you see `👥 johan, sara` under the chat input while guests are connected — `install.sh` wires this up automatically (it wraps your existing statusline if you have one; `copair statusline` is the underlying command). `/copair-who` for an on-demand check.

## How it works

`copair attach` is a tiny sidecar next to your running `claude`:

- **Out:** it follows your session transcript (`~/.claude/projects/...jsonl`) and streams it to guests over a websocket it serves itself (default port `4747`).
- **In:** guest messages are delivered into your live session through Claude Code's local messaging socket — the same channel Claude Code's own cross-session messaging uses.
- **Fork:** on request it ships the full transcript; the guest's copair installs it as a local session and launches `claude --resume` on it.
- The secret token in the invite URL is the only key. New share = new token.

Your session stays a completely normal Claude Code session: same UI, same permissions, same transcript, resumable as always.

### Solo mode (no Claude Code UI)

`copair --solo` hosts a standalone session instead: copair runs its own agent loop via the [Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk/overview) and gives everyone (including you) a shared terminal UI with in-session `/invite`, `/kick`, and y/n permission prompts. Useful where the sidecar can't run; same join command for guests.

## Security notes

- Anyone with the invite URL can join and **prompt an agent that runs tools on your machine** — and can fork a full copy of the transcript. Share it like an SSH key: with people you trust, over a private channel. `ctl stop` + a new invite rotates the token.
- Whatever's in your session (file contents, command output) is visible to guests. Invite accordingly.
- The websocket is unencrypted (`ws://`) — fine on a LAN or inside a VPN tunnel; don't expose the port to the open internet.
- Guest messages are input to your agent like any text you paste: your permission prompts remain the safety boundary, and only you can approve them.

## Requirements

- Node 18+
- [Claude Code](https://claude.com/claude-code) on the **host** (cross-session messaging shipped in v2.1.224+). Guests need Claude Code too only for `fork`; `join` needs nothing but Node.
- Guests must be able to reach the host's IP (same wifi or VPN — note some office networks isolate clients)
- The transcript format copair reads is internal to Claude Code and can change between versions; copair parses defensively and skips what it doesn't recognize

## Why not just screen share?

Screen sharing gives your colleague eyes. copair gives them hands — and gives the *agent* both of you. And when your colleague leaves, the session is still yours: on your machine, in your transcript, resumable like any other.

## License

MIT
