# Content Pack URLs

This is the canonical list of every starter content pack shipped in
`src/constants/packs.ts`. URLs are the ones Ark actually downloads from;
SHA-256 values come from the curated model pack manifest. Custom models
and custom URLs registered by users go through `ContentPackService` and
are not listed here.

## ZIM

Kiwix ZIM archive packs. The content detail screen first tries Ark's
native ZIM reader module when an archive is installed (Android only,
behind dev builds). Builds without the native reader keep the OS handoff
to Kiwix or another reader.

Kiwix publishes SHA-256 sidecars by appending `.sha256` to the ZIM URL.
Ark stores those official checksum links in pack metadata, resolves the
published hash before downloads when network is available, and verifies
SHA-256 after download. Small files use Expo Crypto directly; large ZIM
archives use Ark's chunked SHA-256 path so the archive is not loaded into
memory at once.

| ID                           | Title                         | URL                                                                                  |
| ---------------------------- | ----------------------------- | ------------------------------------------------------------------------------------ |
| `wikipedia-simple-en-nopic`  | Simple English Wikipedia      | `https://download.kiwix.org/zim/wikipedia/wikipedia_en_simple_all_nopic_2026-05.zim` |
| `wikipedia-simple-en-mini`   | Simple English Wikipedia Mini | `https://download.kiwix.org/zim/wikipedia/wikipedia_en_simple_all_mini_2026-05.zim`  |
| `medical-wikipedia-en-nopic` | Medical Wikipedia             | `https://download.kiwix.org/zim/wikipedia/wikipedia_en_medicine_nopic_2026-04.zim`   |
| `wikivoyage-en-nopic`        | Wikivoyage English            | `https://download.kiwix.org/zim/wikivoyage/wikivoyage_en_all_nopic_2026-03.zim`      |
| `wikipedia-en-top100-nopic`  | English Wikipedia Top 100     | `https://download.kiwix.org/zim/wikipedia/wikipedia_en_100_nopic_2026-04.zim`        |

## PDF Guides

Direct PDF downloads. The reader renders pages on device, supports
section jumps, and feeds extracted page text into RAG.

| ID                                   | Title                                                             | URL                                                                                         | Source                  |
| ------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------- |
| `hesperian-first-aid`                | Hesperian First Aid (chapter from _New Where There Is No Doctor_) | `https://hesperian.org/wp-content/uploads/pdf/en_nwtnd_2011/en_nwtnd_2014_03g.pdf`          | Hesperian Health Guides |
| `where-there-is-no-doctor-first-aid` | _Where There Is No Doctor_ (2025 edition, full book)              | `https://hesperian.org/wp-content/uploads/pdf/en_wtnd_2025/en_wtnd_2025_bm.pdf`             | Hesperian Health Guides |
| `us-army-survival-fm-21-76`          | US Army FM 21-76 Survival Manual                                  | `https://ia601604.us.archive.org/28/items/Fm21-76SurvivalManual/FM21-76_SurvivalManual.pdf` | Internet Archive        |

## HTML Snapshots (defuddle-extracted)

`downloadStrategy: html_snapshot`. Ark fetches the URL with `Defuddle` to
strip the live page down to clean Markdown, stores it under the content
directory, and indexes the result for RAG. These are the official
government and public-health pages the library is anchored on.

| ID                        | Title                                | URL                                                                                                   | Source                    |
| ------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------- |
| `disaster-power-outage`   | Power Outages                        | `https://www.ready.gov/power-outages/`                                                                | Ready.gov                 |
| `disaster-floods`         | Floods                               | `https://www.ready.gov/floods`                                                                        | Ready.gov                 |
| `disaster-earthquakes`    | Earthquakes                          | `https://www.ready.gov/earthquakes`                                                                   | Ready.gov                 |
| `disaster-wildfires`      | Wildfires                            | `https://www.ready.gov/wildfires`                                                                     | Ready.gov                 |
| `disaster-extreme-heat`   | Extreme Heat                         | `https://www.ready.gov/heat`                                                                          | Ready.gov                 |
| `disaster-winter-weather` | Winter Weather                       | `https://www.ready.gov/winter-weather`                                                                | Ready.gov                 |
| `food-preservation-usda`  | Food Safety During a Power Outage    | `https://www.foodsafety.gov/food-safety-charts/food-safety-during-power-outage`                       | FoodSafety.gov (USDA/FDA) |
| `sanitation-hygiene`      | Personal Hygiene During an Emergency | `https://www.cdc.gov/water-emergency/safety/guidelines-for-personal-hygiene-during-an-emergency.html` | CDC                       |

## Authored Guides

Markdown content that ships inside the app and is seeded by
`authored-guide-seed.service.ts`. The full text lives in
`src/services/content/authored-guides.ts`; the seed writes a local file
and indexes it for RAG the first time the app sees each id. SHA-256 of
the in-source markdown is used to detect when authored content has
changed and to overwrite stale local copies.

| ID                         | Title                                | Category     |
| -------------------------- | ------------------------------------ | ------------ |
| `household-readiness`      | Household Readiness & Go-Bag         | Preparedness |
| `emergency-water`          | Emergency Water                      | Water        |
| `emergency-power`          | Emergency Power & Battery Discipline | Preparedness |
| `emergency-cooking`        | Emergency Cooking Without Utilities  | Food         |
| `foraging-basics`          | Foraging Risk & Poison Avoidance     | Food         |
| `personal-safety-conflict` | Personal Safety & De-escalation      | Safety       |
| `offline-communications`   | Offline Communications               | Comms        |
| `sanitation-principles`    | Sanitation Principles                | Water        |
| `shelter-evacuation`       | Shelter, Evacuation & Exposure       | Survival     |
| `health-continuity`        | Medication & Health Continuity       | Health       |

## Weather And Feeds

| Source                             | URL                                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| Open-Meteo forecast API            | `https://api.open-meteo.com/v1/forecast`                                          |
| FEMA Disaster Declarations RSS     | `https://www.fema.gov/feeds/disasters.rss`                                        |
| NHC Atlantic Tropical Cyclones RSS | `https://www.nhc.noaa.gov/index-at.xml`                                           |
| USGS Significant Earthquakes Atom  | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.atom` |

## On-Device Chat Models

GGUF model packs downloaded by `DownloadManagerService` into Ark's
`models/` directory. Curated packs ship the SHA-256 that the upstream
publisher exposes for the file; Ark re-verifies after download with
chunked SHA-256. `LlamaAdapter` loads the first installed model in dev
builds; the mock adapter is the Expo-safe fallback.

| ID                           | Title                                | URL                                                                                                           | SHA-256                                                            |
| ---------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `model-qwen25-15b-q4-0`      | Qwen2.5 1.5B Instruct Q4_0 (~1 GB)   | `https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_0.gguf`         | `dcd819ff094852c38faba6873d8ff0c9d51eadb2844539e52042ae5d647bbfdb` |
| `model-gemma4-e2b-it-q4-k-m` | Gemma 4 E2B Instruct Q4_K_M          | `https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_K_M.gguf`                  | `9378bc471710229ef165709b62e34bfb62231420ddaf6d729e727305b5b8672d` |
| `model-gemma4-e4b-it-q4-k-m` | Gemma 4 E4B Instruct Q4_K_M          | `https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf`                  | `519b9793ed6ce0ff530f1b7c96e848e08e49e7af4d57bb97f76215963a54146d` |
| `model-smollm2-17b-q4-0`     | SmolLM2 1.7B Instruct Q4_0 (~1.2 GB) | `https://huggingface.co/QuantFactory/SmolLM2-1.7B-Instruct-GGUF/resolve/main/SmolLM2-1.7B-Instruct.Q4_0.gguf` | `0b1491225b73a81885bfc190d1416e366d6698195285fbd4458caffaac99820e` |

Users can also import a local `.gguf` file or register a custom URL
through `ContentPackService`; those are not curated and do not ship a
publisher SHA-256.

## Embedding Models

Ark no longer ships embedding models as content packs. The
`embedding-models.ts` registry now points at two ExecuTorch
(`react-native-executorch`) text encoders, both of which are bundled
with the native runtime on dev builds and resolved through the standard
embedding context. RAG falls back to the deterministic `ark-hash-v2`
hash embedding when no ExecuTorch context is available (Expo Go, missing
native module, no installed model).

| ID                                      | Dimension | Family     | Title                                    | Notes                                                                          |
| --------------------------------------- | --------- | ---------- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| `executorch-multi-qa-minilm-l6-cos-v1`  | 384       | ExecuTorch | ExecuTorch multi-qa MiniLM source search | Default. Balanced mobile retrieval with lower memory and faster indexing.      |
| `executorch-multi-qa-mpnet-base-dot-v1` | 768       | ExecuTorch | ExecuTorch multi-qa MPNet source search  | Higher-quality retrieval for newer phones, with more memory and indexing cost. |

The `isEmbeddingModelPack` helper in `src/services/ai/embedding-models.ts`
still recognises the legacy `embedding-` id prefix and any title
containing "embedding", so historical manifests keep loading until they
are pruned by `REMOVED_STARTER_PACK_IDS`.

## Safety Notes

- Do not ship mushroom or wild-plant identification content without
  expert local sources and safety review. The current `foraging-basics`
  guide is intentionally a _risk-avoidance_ guide, not an identification
  guide.
- Medical, AI, and weather content is reference-only and must be
  verified for critical decisions.
