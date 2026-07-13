# Testing and CI

## Local Gates

```sh
install
verify
```

`install` is frozen and `verify` runs formatting, typecheck, lint, tests, and documentation checks/build. It excludes all native builds. Ark deliberately installs no commit hook, so commits do not reinstall dependencies or run the full suite.

## GitHub Actions

- `CI`: path-filtered checks plus iOS simulator build when app or workflow files change.
- `React Doctor`: advisory React scan on PRs and `main`.
- `Routing Packs`: manual/tagged Valhalla routing pack generation.
- `Docs`: VitePress build on PRs and Cloudflare Pages deploy on `main` when secrets exist.

## Current CI Fix Notes

The iOS simulator script must run CocoaPods before checking for `ios/Ark.xcworkspace`. `expo prebuild --no-install` creates the native directory and Podfile, but the workspace appears after pod install.

## Device Test Handoff

Automated checks do not replace the Android and iOS native checklist. Use [Android device smoke](/android-device-smoke) and [release checklist](/release/release-checklist) before cutting a release candidate.
