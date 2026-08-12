#!/usr/bin/env bash
# Force-publish pending LSSD autopsy crossposts that were skipped or failed.
#
# Usage (on VPS, from anywhere):
#   bash debug-testing-scripts/force-lssd-crossposts.sh   # dry-run preview (safe)
#   bash debug-testing-scripts/force-lssd-crossposts.sh --post          # actually post
#   bash debug-testing-scripts/force-lssd-crossposts.sh --post --only "Edwin Fimbres"
#
# Requires .env (FORUM_LSSD_USERNAME/PASSWORD, FIREBASE_*) alongside the bot.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[FORCE-LSSD] Using env: $(basename "$(pwd)")"
node debug-testing-scripts/force-lssd-crossposts.mjs "$@"
