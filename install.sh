#!/bin/sh
# couchcoop installer: build, link the `couchcoop` command, install the claude skill.
set -e
cd "$(dirname "$0")"

npm install
npm run build
npm link

mkdir -p "$HOME/.claude/skills/couchcoop" "$HOME/.claude/commands"
cp skill/couchcoop/SKILL.md "$HOME/.claude/skills/couchcoop/SKILL.md"
cp commands/*.md "$HOME/.claude/commands/"
node scripts/setup-statusline.mjs

echo ""
echo "✓ couchcoop installed"
echo "  command:         couchcoop --help"
echo "  in claude:       /couchcoop-invite  /couchcoop-who  /couchcoop-kick <name>  /couchcoop-stop"
