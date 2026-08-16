#!/bin/sh
# couchcoop installer: build, link the `couchcoop` command, install the claude skill.
set -e
cd "$(dirname "$0")"

npm install
npm run build

# Put `couchcoop` on PATH via a small shim (no npm link — survives npm quirks)
REPO="$(pwd)"
BIN_DIR="$HOME/.local/bin"
for d in /opt/homebrew/bin /usr/local/bin; do
  if [ -d "$d" ] && [ -w "$d" ]; then BIN_DIR="$d"; break; fi
done
mkdir -p "$BIN_DIR"
printf '#!/bin/sh\nexec node "%s/dist/cli.js" "$@"\n' "$REPO" > "$BIN_DIR/couchcoop"
chmod +x "$BIN_DIR/couchcoop"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "⚠ add $BIN_DIR to your PATH to use the couchcoop command" ;;
esac

mkdir -p "$HOME/.claude/skills/couchcoop" "$HOME/.claude/commands"
cp skill/couchcoop/SKILL.md "$HOME/.claude/skills/couchcoop/SKILL.md"
cp commands/*.md "$HOME/.claude/commands/"
node scripts/setup-statusline.mjs

echo ""
echo "✓ couchcoop installed"
echo "  command:         couchcoop --help"
echo "  in claude:       /couchcoop-invite  /couchcoop-who  /couchcoop-kick <name>  /couchcoop-stop"
