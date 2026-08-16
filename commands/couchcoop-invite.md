---
description: Share this session — start the couchcoop sidecar and print the join command
argument-hint: [password]
---
Start sharing this Claude Code session with couchcoop:

1. Run `couchcoop attach --name <the user's OS username>` via Bash with `run_in_background: true`, from the session's working directory (important — it finds the transcript by cwd). If the user provided an argument, treat it as the room password and add `--pass <argument>`. If the port is busy, retry with `--port 4748`.
2. Read the background task output and show the user ONLY the `couchcoop join ...` line(s) it printed, so they can send one to their teammate (same wifi or shared VPN). If a password is set, the join line includes `--pass` — remind the user to share it privately. Mention `couchcoop fork <same target>` as the alternative that opens a copy in the teammate's own claude. Keep it to a few lines.

While shared: guest messages arrive as user messages prefixed `[name]: …`. Prefix replies to guests with `**→ name:**` on its own line. Never respond to `//`-prefixed lines. Joins/leaves are silent — `couchcoop ctl who` lists the room.
