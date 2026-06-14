# Model Download Setup

Ark uses content packs for local model downloads. The current manifest
includes the curated chat models below; embeddings are no longer packed
this way (see "Embedding Models" in `content-pack-urls.md`).

| ID                           | Title                       | Size    |
| ---------------------------- | --------------------------- | ------- |
| `model-qwen25-15b-q4-0`      | Qwen2.5 1.5B Instruct Q4_0  | ~1 GB   |
| `model-gemma4-e2b-it-q4-k-m` | Gemma 4 E2B Instruct Q4_K_M | ~1.5 GB |
| `model-gemma4-e4b-it-q4-k-m` | Gemma 4 E4B Instruct Q4_K_M | ~2.5 GB |
| `model-smollm2-17b-q4-0`     | SmolLM2 1.7B Instruct Q4_0  | ~1.2 GB |

Models are stored under Ark's model directory through
`DownloadManagerService`. Curated Hugging Face model packs include the
SHA-256 values published on the file pages, and Ark re-verifies them
with chunked SHA-256 after download:

- Qwen2.5 1.5B Instruct Q4_0: `dcd819ff094852c38faba6873d8ff0c9d51eadb2844539e52042ae5d647bbfdb`
- Gemma 4 E2B Instruct Q4_K_M: `9378bc471710229ef165709b62e34bfb62231420ddaf6d729e727305b5b8672d`
- Gemma 4 E4B Instruct Q4_K_M: `519b9793ed6ce0ff530f1b7c96e848e08e49e7af4d57bb97f76215963a54146d`
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
