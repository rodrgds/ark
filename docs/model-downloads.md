# Model Download Setup

Ark uses content packs for local model downloads. The current manifest includes:

- Qwen2.5 1.5B Instruct Q4_0 GGUF, around 1 GB.
- SmolLM2 1.7B Instruct Q4_0 GGUF, around 1.2 GB.

These are stored under Ark's model directory through `DownloadManagerService`.
Curated Hugging Face model packs include the SHA-256 values published on the file pages:

- Qwen2.5 1.5B Instruct Q4_0: `dcd819ff094852c38faba6873d8ff0c9d51eadb2844539e52042ae5d647bbfdb`
- SmolLM2 1.7B Instruct Q4_0: `0b1491225b73a81885bfc190d1416e366d6698195285fbd4458caffaac99820e`

Custom model URLs can include an optional MD5 or SHA-256 checksum. MD5 is compared with the value
reported by Expo's resumable download API. SHA-256 is stored in the download row and verified for
small files through Expo Crypto and for large model files with Ark's chunked SHA-256 path.

## Runtime Plan

1. Build a development client so the `llama.rn` JSI bindings exist at runtime.
2. Verify chunked SHA-256 performance on real devices with multi-GB model files.
3. Add device memory checks before loading a model.
4. Tune `LlamaAdapter` on real devices.

`npx llama-rn-download-artifacts` reports cached Android `jniLibs` and iOS
`rnllama.xcframework` artifacts in this workspace.

Gemma-class models are intentionally not enabled in-app until license gates and device memory guidance are resolved.
