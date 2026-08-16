#!/bin/sh
# copair installer: build, link the `copair` command, install the claude skill.
set -e
cd "$(dirname "$0")"

npm install
npm run build
npm link

mkdir -p "$HOME/.claude/skills/copair" "$HOME/.claude/commands"
cp skill/copair/SKILL.md "$HOME/.claude/skills/copair/SKILL.md"
cp commands/*.md "$HOME/.claude/commands/"

echo ""
echo "✓ copair installed"
echo "  command:         copair --help"
echo "  in claude:       /copair-invite  /copair-who  /copair-kick <name>  /copair-stop"
