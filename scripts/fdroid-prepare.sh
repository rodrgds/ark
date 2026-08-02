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
# its own gradle, so the committed wrapper is not used. Some tools hardcode a
# Java 17 toolchain/bytecode target that the server cannot satisfy, so patch
# every 17 up to 21. This covers:
#   - the RN gradle-plugin's own included builds (jvmToolchain 17 -> 21), which
#     is what unblocks :gradle-plugin:*:compileKotlin;
#   - JdkConfiguratorUtils (forces toolchain 17 -> 21 on the app and every
#     library subproject);
#   - each vendor module that sets an explicit JavaVersion.VERSION_17 and/or
#     Kotlin jvmTarget 17 (worklets, reanimated, audio-api, RN core): aligning
#     them to 21 avoids the Kotlin/JVM target-compatibility failure.
sed -i '/jvmToolchain\|JavaVersion/s/17/21/' \
  node_modules/@react-native/gradle-plugin/*/build.gradle.kts \
  node_modules/@react-native/gradle-plugin/react-native-gradle-plugin/src/main/kotlin/com/facebook/react/utils/JdkConfiguratorUtils.kt

find node_modules -path '*/android/build.gradle*' -exec sed -i \
  -e '/VERSION_17/s/17/21/' \
  -e '/fromTarget\|jvmTarget/s/17/21/' {} +

# The F-Droid build does not run expo prebuild, so the committed
# android/gradle.properties (a 12 GiB heap for local/CI prebuilds) must be
# capped for the build server. Later keys override earlier ones in a properties
# file, so appending the reduced daemon heap wins.
printf '%s\n' \
  'org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8' \
  'org.gradle.parallel=false' \
  'org.gradle.workers.max=2' >> android/gradle.properties
