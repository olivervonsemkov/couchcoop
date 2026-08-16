# copair

**Invite a teammate into your live Claude Code session — without leaving it.**

You're pair programming with your agent and you're stuck, or you just want a second pair of eyes. Instead of pushing a PR and writing a novel of context, you ask Claude to invite your colleague. They join from their own terminal: full conversation history, live agent output, and a prompt of their own. Everyone talks to each other and to the agent. Tools run on your machine, under your permissions, and you stay in your normal `claude` the whole time.

No accounts. No server. No cloud. Your machine **is** the server — works over the same wifi or any shared VPN (Tailscale, WireGuard, office VPN).

```
  OLIVER (in claude, as usual)         JOHAN (guest)
┌─────────────────────────────┐
│ > invite johan               │
│ ⚒ npx copair attach          │
│ → npx copair join            │
│   192.168.1.24:4747#a8f3     │──── Slack ────┐
│                              │               ▼
│ [copair] johan joined        │◄── ✓ joined oliver's session
│                              │    (sees the whole conversation)
│ [johan] is auth green?       │    johan: is auth green?
│ claude: the diff looks ok,   │    claude: the diff looks ok,
│   but retry is missing…      │      but retry is missing…
└─────────────────────────────┘
```

## Quick start

**Host** — install the skill once, then just ask Claude:

```sh
mkdir -p ~/.claude/skills/copair
curl -fsSL https://raw.githubusercontent.com/<you>/copair/main/skill/copair/SKILL.md \
  -o ~/.claude/skills/copair/SKILL.md
```

Then, inside your normal `claude` session: *"invite johan"* — Claude starts the sidecar and gives you the join link. (No skill? Ask Claude to run `npx copair attach` in the background — that's all the skill does.)

**Guest** — anywhere that can reach the host (same wifi or VPN):

```sh
npx copair join 192.168.1.24:4747#a8f3k2 --name johan
```

That's it.

## What guests can do

- Read the conversation so far (recent history is replayed on join) and everything live from then on: your messages, the agent's replies, tool activity.
- Talk to the agent — their messages land in your session prefixed `[johan]`, and the agent addresses people by name.
- Talk humans-only with `// like this` — the agent never sees it, costs no tokens.
- Leave with `/leave`. They approve nothing and run nothing: permission prompts stay with you.

## Managing the room

Ask Claude (or run yourself):

```sh
npx copair ctl who            # who's in the room
npx copair ctl kick johan     # remove a guest
npx copair ctl stop           # stop sharing, disconnect everyone
```

## How it works

`copair attach` is a tiny sidecar next to your running `claude`:

- **Out:** it follows your session transcript (`~/.claude/projects/...jsonl`) and streams it to guests over a websocket it serves itself (default port `4747`).
- **In:** guest messages are delivered into your live session through Claude Code's local messaging socket — the same channel Claude Code's own cross-session messaging uses.
- The secret token in the invite URL is the only key. New share = new token.

Your session stays a completely normal Claude Code session: same UI, same permissions, same transcript, resumable as always.

### Solo mode (no Claude Code UI)

`copair --solo` hosts a standalone session instead: copair runs its own agent loop via the [Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk/overview) and gives everyone (including you) a shared terminal UI with in-session `/invite`, `/kick`, and y/n permission prompts. Useful where the sidecar can't run; same join command for guests.

## Security notes

- Anyone with the invite URL can join and **prompt an agent that runs tools on your machine**. Share it like an SSH key: with people you trust, over a private channel. `ctl stop` + `attach` rotates the token.
- The recent transcript is replayed to joiners — whatever's in your session (file contents, command output) is visible to them. Invite accordingly.
- The websocket is unencrypted (`ws://`) — fine on a LAN or inside a VPN tunnel; don't expose the port to the open internet.
- Guest messages are input to your agent like any text you paste: your permission prompts remain the safety boundary, and only you can approve them.

## Requirements

- Node 18+
- [Claude Code](https://claude.com/claude-code) on the **host** (cross-session messaging shipped in v2.1.224+; guests need nothing but Node)
- Guests must be able to reach the host's IP (same wifi or VPN — note some office networks isolate clients)
- The transcript format copair reads is internal to Claude Code and can change between versions; copair parses defensively and skips what it doesn't recognize

## Why not just screen share?

Screen sharing gives your colleague eyes. copair gives them hands — and gives the *agent* both of you. And when your colleague leaves, the session is still yours: on your machine, in your transcript, resumable like any other.

## License

MIT
