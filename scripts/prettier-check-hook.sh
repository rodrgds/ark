#!/usr/bin/env bash
set -euo pipefail

export BUN_TMPDIR="${BUN_TMPDIR:-/tmp/bun-tmp}"
if [ ! -w "${BUN_INSTALL:-/tmp/bun-install}" ]; then
  export BUN_INSTALL="/tmp/bun-install"
else
  export BUN_INSTALL="${BUN_INSTALL:-/tmp/bun-install}"
fi
export TMPDIR="${TMPDIR:-/tmp/bun-tmp}"

mkdir -p "$BUN_TMPDIR" "$BUN_INSTALL" "$TMPDIR"
cd /home/rgo-agent/Projects/ark

bun install --frozen-lockfile
bunx prettier --check .
