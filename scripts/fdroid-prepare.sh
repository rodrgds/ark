#!/usr/bin/env bash
# Deterministic dependency preparation for the F-Droid build.
#
# F-Droid build servers ship node/npm but not Bun. Ark pins Bun and uses
# `bun.lock` (npm cannot apply Ark's `patchedDependencies`), so this installs
# the pinned Bun binary from its published npm package (no curl|bash) and then
# installs the locked dependency tree exactly like the GitHub release builds.
#
# The fdroiddata recipe runs this from the repository root:
#   prebuild:
#     - cd ..
#     - bash scripts/fdroid-prepare.sh
set -euo pipefail

BUN_VERSION="${BUN_VERSION:-1.3.3}"

if ! command -v bun >/dev/null 2>&1; then
  npm install --global "bun@${BUN_VERSION}"
fi

bun --version
bun install --frozen-lockfile
