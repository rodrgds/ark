# Screenshots

The public README should not link placeholder screenshots. Commit real captures before a Reddit/open-source announcement.

## Required files

Place screenshots here:

```text
docs/screenshots/home.png
docs/screenshots/library.png
docs/screenshots/map.png
docs/screenshots/chat.png
docs/screenshots/notes.png
docs/screenshots/tools.png
docs/screenshots/settings.png
```

## Capture settings

- Use the OLED theme unless the screenshot specifically demonstrates light/system mode.
- Use a clean seeded profile, not personal notes, real coordinates, private documents, or private chat history.
- Use a realistic downloaded-pack state: at least one guide installed, one map region available, and one model listed if AI is shown.
- Prefer Android screenshots first because Android is the main beta testing target.
- Crop only device chrome if needed; do not crop out important navigation context.
- Keep dimensions consistent across all screenshots.

## Suggested sequence

1. **Home:** offline readiness status, core cards, serious utility tone.
2. **Library:** downloadable packs, installed state, progress/download controls.
3. **Map:** offline region/saved spot/routing state without exposing private coordinates.
4. **Chat:** Ask Arky answer with citations/source cards, using harmless preparedness content.
5. **Notes:** vault-gated secure notes list with non-private sample notes.
6. **Tools:** compass/barometer/level/checklist hub.
7. **Settings:** downloads, diagnostics, theme/security, and native capability status.

## README snippet once files exist

```md
## Screenshots

<p align="center">
  <img src="docs/screenshots/home.png" alt="Ark home" width="180" />
  <img src="docs/screenshots/library.png" alt="Ark library" width="180" />
  <img src="docs/screenshots/map.png" alt="Ark offline map" width="180" />
  <img src="docs/screenshots/chat.png" alt="Ask Arky" width="180" />
</p>
```
