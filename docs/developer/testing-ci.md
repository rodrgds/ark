# Testing and CI

## Local Gates

```sh
bun run typecheck
bun run lint
bun run test
bun run check:docs
bun run docs:build
```

Use `devenv shell -- format-check` before committing larger changes that touch many files.

## GitHub Actions

- `CI`: path-filtered checks plus iOS simulator build when app or workflow files change.
- `React Doctor`: advisory React scan on PRs and `main`.
- `Routing Packs`: manual/tagged Valhalla routing pack generation.
- `Docs`: VitePress build on PRs and Cloudflare Pages deploy on `main` when secrets exist.

## Current CI Fix Notes

The iOS simulator script must run CocoaPods before checking for `ios/Ark.xcworkspace`. `expo prebuild --no-install` creates the native directory and Podfile, but the workspace appears after pod install.

## Device Test Handoff

Automated checks do not replace the Android and iOS native checklist. Use [Android device smoke](/android-device-smoke) and [release checklist](/release/release-checklist) before cutting a release candidate.
