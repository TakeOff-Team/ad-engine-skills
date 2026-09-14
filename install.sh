#!/usr/bin/env bash
# ad-engine-skills / install.sh
# Copies the six skills into ~/.claude/skills, installs the renderer, runs the doctor.
# Safe to re-run: existing skill folders are replaced (your brand context lives in your
# project's clients/ folder, never inside the skill folders, so nothing of yours is touched).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
SKILLS=(ad-engine ad-onboard ad-research ad-batch ad-review ad-copy)

echo ""
echo "ad-engine-skills installer"
echo "  from: $HERE/skills"
echo "  to:   $DEST"
echo ""

command -v node >/dev/null 2>&1 || { echo "Node is required (18 or newer). Install from https://nodejs.org and re-run."; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then echo "Node $NODE_MAJOR found; 18 or newer is required."; exit 1; fi

mkdir -p "$DEST"
for s in "${SKILLS[@]}"; do
  rm -rf "$DEST/$s"
  cp -R "$HERE/skills/$s" "$DEST/$s"
  echo "  installed $s"
done

echo ""
echo "Installing the renderer (Playwright + Chromium, about 500 MB, one time)..."
( cd "$DEST/ad-engine/render" && npm install --no-audit --no-fund --silent && npx playwright install chromium )

echo ""
node "$DEST/ad-engine/render/doctor.js" || true

echo ""
echo "Done. Next, in Claude Code:"
echo "  1. Connect Firecrawl:  claude mcp add --transport http -s user firecrawl https://mcp.firecrawl.dev/YOUR_API_KEY/v2/mcp"
echo "  2. Connect Higgsfield through the connector in your Claude settings"
echo "  3. Run:  /ad-engine https://any-brand.com"
echo ""
echo "See it render without any keys:  cd $DEST/ad-engine/render && node render.js examples/render-spec.example.json --sheet"
echo ""
