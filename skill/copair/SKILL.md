---
name: copair
description: Share this live Claude Code session with a teammate — start/stop the copair sidecar, print the invite link, see who's in the room, kick guests. Use when the user says things like "invite <name>", "share this session", "copair", "who's in the room", or "kick <name>".
---

# copair — share this session with a teammate

copair lets other people join this very session from their own terminals: they see the conversation, can talk to the user and to you, and their messages arrive here prefixed `[name]`. All tools still run on this machine under this user's permissions.

## Start sharing / invite someone

Run the sidecar in the background from the project root (the session's working directory — important, it locates the transcript by cwd):

```bash
copair attach --name <username>
```

Use `run_in_background: true`. Then read the task output: it prints one or more lines like

```
  copair join 192.168.1.24:4747#a8f3k2
```

Show those join commands to the user so they can send one to their teammate (same wifi or shared VPN). If port 4747 is busy, retry with `--port 4748` and pass the same `--port` to ctl commands later.

Also mention the teammate's second option: `copair fork <same target>` copies the session onto their machine and opens it in their own claude — full scrollable history, but from there they talk to their own agent (best when they have the same repo checked out). `join` = live together; `fork` = read in and continue solo.

## While shared

- Messages from guests arrive as user messages prefixed `[name]: …`.
- **When replying to a guest's message, start your reply with `**→ name:**` on its own line** (e.g. `**→ johan:**`) so the user can see at a glance that the answer is addressed to the guest, not to them. Replies to the user need no prefix.
- Joins/leaves are NOT announced in the session. To see who's in the room, run `copair ctl who` — do it when the user asks, or before addressing someone by name if unsure.
- If the user writes a line starting with `//`, it is human-to-human chat: do not respond to it at all.
- Guests see the transcript live but approve nothing: permission prompts stay with the user here.

## Manage the room

```bash
copair ctl who            # list who's in the room
copair ctl kick <name>    # remove a guest
copair ctl stop           # stop sharing (disconnects all guests)
```

(Add `--port <port>` if a non-default port was used.)

## Notes

- Only start `attach` when the user asks to share/invite. Only kick or stop when the user asks.
- The invite token is a secret: anyone with it can join and talk to this session. If the user wants a fresh token, `ctl stop` and `attach` again.
- If `attach` fails with "CLAUDE_CODE_MESSAGING_SOCKET is not set", it was run outside the session — it must be run via this session's Bash tool.
