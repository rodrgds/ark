# Ask Arky and Source Search

Ask Arky is Ark's local assistant surface. It searches local sources before answering and cites matching notes, guides, documents, and cached content when available.

## Answer Modes

- Mock fallback keeps the UI testable when no native model is installed.
- GGUF model support uses llama.rn in development builds when a compatible model is installed.
- Source search combines SQLite FTS, embedding-based reranking when available, and a deterministic fallback for low-power builds.

## Source Search Choices

- Fast is the default search model for lower memory use.
- Thorough uses a larger embedding model and can take longer to rebuild.
- Battery Reduce Mode can fall back to the deterministic hash matcher.

## Practical Use

Install the sources you want Ark to cite before relying on offline answers. Local AI output can still be wrong. For medical, survival, weather, legal, or route decisions, verify against official or expert sources.
