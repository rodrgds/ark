# Vault, Notes, and Backups

Ark keeps personal notes and backups local. Vault passphrase protection is optional, and database encryption can be enabled separately when SQLCipher is available in the build.

## Vault Protection

- Passphrase protection can be enabled during onboarding or later in Settings > Security.
- Biometrics can unlock the vault when passphrase protection is enabled.
- Auto-lock runs from app activity and background/foreground transitions.
- Notes are gated when the vault is locked.

## Database Encryption

Fresh installs default to plaintext for speed and battery life. Settings > Security can encrypt the database or return it to plaintext when the native SQLCipher runtime is available. This migration path still needs device proof before production claims.

## Backups

Encrypted `.arkbackup` files include settings, field preferences, notes, documents, document pages, map markers, routes, tracks, RSS subscriptions, chat threads, and chat messages.

Backups intentionally exclude downloaded map tiles, ZIM archives, model files, generated embeddings, OCR indexes, caches, and active download queues.
