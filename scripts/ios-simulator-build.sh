#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

run_expo() {
  if [[ -x ./node_modules/.bin/expo ]]; then
    ./node_modules/.bin/expo "$@"
  else
    bunx expo "$@"
  fi
}

if [[ "${ARK_IOS_PREBUILD:-0}" == "1" || ! -d ios/Ark.xcworkspace ]]; then
  run_expo prebuild --platform ios --no-install
fi

if [[ ! -d ios/Ark.xcworkspace ]]; then
  echo "ios/Ark.xcworkspace was not generated." >&2
  exit 1
fi

if [[ "${ARK_IOS_POD_INSTALL:-1}" != "0" ]]; then
  if ! command -v pod >/dev/null 2>&1; then
    echo "CocoaPods is required for the iOS simulator build." >&2
    exit 1
  fi
  (cd ios && pod install)
fi

export RCT_NO_LAUNCH_PACKAGER=1

ios_sim_archs="${ARK_IOS_SIM_ARCHS:-$(uname -m)}"
xcodebuild_args=(
  -workspace ios/Ark.xcworkspace \
  -scheme Ark \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "${ARK_IOS_DERIVED_DATA_PATH:-ios/build/ci}" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY=""
)

if [[ "${ARK_IOS_UNIVERSAL_SIM:-0}" != "1" ]]; then
  echo "Building iOS simulator project for: ${ios_sim_archs}"
  xcodebuild_args+=(ARCHS="${ios_sim_archs}" ONLY_ACTIVE_ARCH=YES)
fi

if [[ "${ARK_IOS_XCODEBUILD_QUIET:-1}" == "0" ]]; then
  xcodebuild "${xcodebuild_args[@]}" build
else
  xcodebuild_log="${ARK_IOS_XCODEBUILD_LOG:-ios/build/ci/xcodebuild.log}"
  mkdir -p "$(dirname "$xcodebuild_log")"

  if xcodebuild -quiet "${xcodebuild_args[@]}" build >"$xcodebuild_log" 2>&1; then
    echo "iOS simulator build succeeded. Full log: ${xcodebuild_log}"
  else
    status=$?
    echo "iOS simulator build failed. Last 200 log lines from ${xcodebuild_log}:" >&2
    tail -n 200 "$xcodebuild_log" >&2 || true
    exit "$status"
  fi
fi
