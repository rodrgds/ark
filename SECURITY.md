# Security Policy

Ark is a local-first app that stores sensitive user-created data on device. Treat security reports seriously even while the project is beta-stage.

## Supported versions

Security fixes target the current `main` branch until tagged releases exist.

| Version | Supported |
| --- | --- |
| `main` | Yes |
| Older commits / forks | No |

## Report a vulnerability

Do not open a public GitHub issue for vulnerabilities.

Report privately by emailing the repository owner or using GitHub's private vulnerability reporting if it is enabled for this repository.

Include:

- Affected commit/version.
- Platform and device/build profile.
- Clear reproduction steps.
- Impact: data disclosure, data loss, lock bypass, unsafe network behavior, supply-chain risk, or other.
- Any logs, proof-of-concept notes, or screenshots that do not expose someone else's private data.

## Security-sensitive areas

- Vault unlock, biometric unlock, rate limiting, and auto-lock.
- SecureStore and database key handling.
- Backup export/import.
- Imported documents and ZIM/PDF/HTML parsing.
- Download verification and remote manifests.
- Local AI/model downloads and custom model URLs.
- Map/routing pack downloads and checksum validation.

## Current beta limitations

Ark is not yet a hardened password manager or medical/emergency authority. Some native-heavy security behavior depends on development-build verification. See `docs/release-readiness.md` and `docs/development-build.md` before presenting the app as production-secure.

## Disclosure expectations

Please give maintainers a reasonable window to investigate and patch before public disclosure. Avoid sharing exploit details publicly until a fix or mitigation is available.
