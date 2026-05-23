# Model Download Setup

Ark uses content packs for local model downloads. The current manifest includes:

- Qwen2.5 1.5B Instruct Q4_0 GGUF, around 1 GB.
- SmolLM2 1.7B Instruct Q4_0 GGUF, around 1.2 GB.

These are stored under Ark's model directory through `DownloadManagerService`.
Custom model URLs can include an optional MD5 checksum. When present, Ark compares it with the MD5
reported by Expo's resumable download API and rejects corrupted downloads.

## Runtime Plan

1. Build a development client so the `llama.rn` JSI bindings exist at runtime.
2. Add published checksum metadata to curated model packs where the source provides it.
3. Add device memory checks before loading a model.
4. Extend `LlamaAdapter` with token streaming, cancellation, and context-window limits.

`npx llama-rn-download-artifacts` reports cached Android `jniLibs` and iOS
`rnllama.xcframework` artifacts in this workspace.

Gemma-class models are intentionally not enabled in-app until license gates and device memory guidance are resolved.
