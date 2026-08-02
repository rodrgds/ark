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

# The F-Droid build server runs Java 21 (Debian trixie) and fdroidserver uses
# its own gradle, so the committed wrapper is not used. React Native's
# gradle-plugin hardcodes a Java 17 toolchain that the server cannot satisfy;
# patch it to 21 (the fdroiddata RN template does the same). The app's own
# modules keep the RN-requested Java 17 bytecode targets.
sed -i '/jvmToolchain\|JavaVersion/s/17/21/' \
  node_modules/@react-native/gradle-plugin/*/build.gradle.kts \
  node_modules/@react-native/gradle-plugin/react-native-gradle-plugin/src/main/kotlin/com/facebook/react/utils/JdkConfiguratorUtils.kt

# The F-Droid build does not run expo prebuild, so the committed
# android/gradle.properties (a 12 GiB heap for local/CI prebuilds) must be
# capped for the build server. Later keys override earlier ones in a properties
# file, so appending the reduced daemon heap wins.
printf '%s\n' \
  'org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8' \
  'org.gradle.parallel=false' \
  'org.gradle.workers.max=2' >> android/gradle.properties
