#!/bin/bash
# Cloud sessions only: install dependencies and use the preinstalled Chromium.
# Local machines keep Playwright's pinned browser (npx playwright install chromium).
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR"
[ -d node_modules ] || npm ci --no-audit --no-fund >/dev/null
if [ -x /opt/pw-browsers/chromium ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export CAROUSEL_CHROMIUM=/opt/pw-browsers/chromium" >> "$CLAUDE_ENV_FILE"
fi
