#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DIST_DIR="${ARK_ANDROID_RELEASE_DIR:-dist/android-release}"
OUTPUT_DIR="android/app/build/outputs/apk/release"
VERSION_NAME="$(node -e "process.stdout.write(require('./app.json').expo.version)")"
VERSION_CODE="$(node -e "process.stdout.write(String(require('./app.json').expo.android.versionCode))")"
RELEASE_TAG="${ARK_RELEASE_TAG:-${GITHUB_REF_NAME:-v${VERSION_NAME}}}"
WORKLETS_PREWARM_DIR="${ARK_WORKLETS_PREWARM_DIR:-${RUNNER_TEMP:-/tmp}/ark-worklets-prewarm}"
WORKLETS_PREWARM_LOG="${ARK_WORKLETS_PREWARM_LOG:-${WORKLETS_PREWARM_DIR}/metro.log}"

prewarm_worklets_bundle_mode() {
  local attempt
  for attempt in 1 2; do
    rm -rf "$WORKLETS_PREWARM_DIR"
    mkdir -p "$WORKLETS_PREWARM_DIR/assets"

    echo "Prewarming Worklets bundle-mode files with Metro (attempt ${attempt}/2)..."
    if NODE_ENV=production bunx expo export:embed \
      --platform android \
      --dev false \
      --entry-file node_modules/expo-router/entry.js \
      --bundle-output "$WORKLETS_PREWARM_DIR/index.android.bundle" \
      --assets-dest "$WORKLETS_PREWARM_DIR/assets" \
      2>&1 | tee "$WORKLETS_PREWARM_LOG"; then
      return 0
    fi

    if ! grep -Eq 'Failed to get the SHA-1 for: .*/node_modules/react-native-worklets/\.worklets/.*\.js' "$WORKLETS_PREWARM_LOG"; then
      echo "Worklets prewarm failed for an unexpected reason." >&2
      return 1
    fi

    echo "Metro hit the expected Worklets generated-file SHA-1 race; retrying with generated files present."
  done

  echo "Worklets prewarm did not complete after retry." >&2
  return 1
}

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

prewarm_worklets_bundle_mode

bun run android:build:prod

shopt -s nullglob
apks=("$OUTPUT_DIR"/*.apk)
if (( ${#apks[@]} == 0 )); then
  echo "No release APKs found in $OUTPUT_DIR" >&2
  exit 1
fi

copied=()
for apk in "${apks[@]}"; do
  base="$(basename "$apk")"
  abi="universal"
  case "$base" in
    *armeabi-v7a*) abi="armeabi-v7a" ;;
    *arm64-v8a*) abi="arm64-v8a" ;;
    *x86_64*) abi="x86_64" ;;
    *x86*) abi="x86" ;;
    *universal* | app-release.apk) abi="universal" ;;
    *) abi="${base%.apk}" ;;
  esac

  target="$DIST_DIR/Ark-${RELEASE_TAG}-android-${abi}.apk"
  if [[ -e "$target" ]]; then
    target="$DIST_DIR/Ark-${RELEASE_TAG}-android-${abi}-${base}"
  fi
  cp "$apk" "$target"
  copied+=("$(basename "$target")")
done

(
  cd "$DIST_DIR"
  shasum -a 256 ./*.apk > SHA256SUMS.txt
  {
    echo "Ark Android release APKs"
    echo "Tag: ${RELEASE_TAG}"
    echo "Version name: ${VERSION_NAME}"
    echo "Version code: ${VERSION_CODE}"
    if [[ -n "${ARK_ANDROID_KEYSTORE_PATH:-}" ]]; then
      echo "Signing: configured release keystore"
    else
      echo "Signing: generated debug keystore fallback"
    fi
    echo
    echo "Assets:"
    printf -- "- %s\n" "${copied[@]}"
  } > APK_MANIFEST.txt
)

echo "Android release APKs written to $DIST_DIR"
printf '  %s\n' "${copied[@]}"
