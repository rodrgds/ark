# Screenshots

The public README must only link reviewed captures. Chat and Notes captures were removed after a
privacy and answer-safety review; recapture them from a clean synthetic profile before restoring
those slots.

## Required files

Place screenshots here:

```text
docs/screenshots/library.png
docs/screenshots/map.png
docs/screenshots/chat.png       # pending recapture
docs/screenshots/notes.png      # pending recapture
```

## Capture settings

- Use the OLED theme unless the screenshot specifically demonstrates light/system mode.
- Use a clean seeded profile, not personal notes, real coordinates, private documents, or private chat history.
- Use a realistic downloaded-pack state: at least one guide installed, one map region available, and one model listed if AI is shown.
- Prefer Android screenshots first because Android is the main beta testing target.
- Crop only device chrome if needed; do not crop out important navigation context.
- Keep dimensions consistent across all screenshots.
- Review every visible name, health detail, coordinate, document title, and chat sentence as if the
  image were already public.
- Run Settings > Advanced > Offline answer safety check before capturing Chat. Do not publish a
  response that fails source-mismatch or citation checks.

## Suggested sequence

1. **Library:** downloadable packs, installed state, progress/download controls.
2. **Map:** offline region/saved spot/routing state without exposing private coordinates.
3. **Chat:** Ask Arky answer with citations/source cards, using harmless water-storage or outage
   readiness content that passed the offline answer safety check.
4. **Notes:** passphrase-protected secure notes using obviously synthetic names and non-medical
   sample content.

## README snippet once files exist

```md
## Screenshots

<p align="center">
  <img src="docs/screenshots/library.png" alt="Ark library" width="180" />
  <img src="docs/screenshots/map.png" alt="Ark offline map" width="180" />
  <img src="docs/screenshots/chat.png" alt="Ask Arky" width="180" />
  <img src="docs/screenshots/notes.png" alt="Ark notes" width="180" />
</p>
```
