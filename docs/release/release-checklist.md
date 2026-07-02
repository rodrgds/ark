# Release Checklist

Ark is not production-released yet. Use this list before the first promoted build.

## Code Gates

- `bun run check`
- `bun run check:docs`
- `bun run docs:build`
- GitHub `CI` green on `main`
- GitHub `React Doctor` reviewed
- Docs deploy green or intentionally skipped because Cloudflare secrets are not configured

## Android Proof

- Fresh install boots offline
- Onboarding completes
- Vault enable/change/disable works
- SQLCipher plaintext/encrypted migration works when available
- MapLibre renders
- Offline map download survives restart
- Route graph downloads and calculates a route
- Tracks record foreground and background samples
- ZIM archive opens and searches
- OCR/PDF extraction succeeds or fails with recoverable states
- Local model load and stop/cancel behavior works
- Backup export/import restores durable data

## Public Positioning

- README is concise and user-facing
- Docs site explains both user and developer paths
- Screenshots contain no private data
- Known limitations are explicit
- F-Droid metadata exists, but F-Droid scanner findings are still unresolved until a real fdroidserver test runs

See [release readiness](/release-readiness) for the durable risk log.
