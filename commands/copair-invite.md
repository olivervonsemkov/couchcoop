---
description: Share this session — start the copair sidecar and print the join command
---
Start sharing this Claude Code session with copair:

1. Run `copair attach --name <the user's OS username>` via Bash with `run_in_background: true`, from the session's working directory (important — it finds the transcript by cwd). If the port is busy, retry with `--port 4748`.
2. Read the background task output and show the user ONLY the `copair join ...` line(s) it printed, so they can send one to their teammate (same wifi or shared VPN). Mention `copair fork <same target>` as the alternative that opens a copy in the teammate's own claude. Keep it to a few lines.

While shared: guest messages arrive as user messages prefixed `[name]: …`. Prefix replies to guests with `**→ name:**` on its own line. Never respond to `//`-prefixed lines. Joins/leaves are silent — `copair ctl who` lists the room.
