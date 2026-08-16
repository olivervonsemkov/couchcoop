#!/bin/sh
# copair installer: build, link the `copair` command, install the claude skill.
set -e
cd "$(dirname "$0")"

npm install
npm run build
npm link

mkdir -p "$HOME/.claude/skills/copair"
cp skill/copair/SKILL.md "$HOME/.claude/skills/copair/SKILL.md"

echo ""
echo "✓ copair installed"
echo "  command:       copair --help"
echo "  claude skill:  say \"invite <name>\" in a new claude session to share it"
