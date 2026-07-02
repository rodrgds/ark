# Data and Content

Ark's offline value depends on content that is explicit, cacheable, and recoverable.

## Content Packs

Curated packs live in app constants and download services. They cover:

- Authored guides
- Public PDFs
- Kiwix ZIM archives
- Map and routing packs
- Model packs

See [content pack URLs](/content-pack-urls) for the current source list.

## Downloads

The download manager tracks queue state, byte progress, resume data, expected checksums, actual checksums, verification state, and terminal errors. Download failures should not block boot.

## RAG and Search

RAG sources include guides, notes, imported documents, PDF pages, image OCR text, and lazy ZIM paragraph context. Source-search indexing must keep a previous working index if a rebuild fails.

## Backups

Backup v3 includes durable user content and excludes generated or re-downloadable payloads. Restore paths must reindex FTS after import.
