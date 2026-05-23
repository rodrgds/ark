# Content Pack URLs

## ZIM

- Simple English Wikipedia nopic: `https://download.kiwix.org/zim/wikipedia/wikipedia_en_simple_all_nopic_2026-05.zim`
- Simple English Wikipedia mini: `https://download.kiwix.org/zim/wikipedia/wikipedia_en_simple_all_mini_2026-05.zim`
- Medical Wikipedia nopic: `https://download.kiwix.org/zim/wikipedia/wikipedia_en_medicine_nopic_2026-04.zim`
- Wikivoyage English nopic: `https://download.kiwix.org/zim/wikivoyage/wikivoyage_en_all_nopic_2026-03.zim`
- Wikipedia Top 100 smoke test: `https://download.kiwix.org/zim/wikipedia/wikipedia_en_100_nopic_2026-04.zim`

Kiwix publishes SHA-256 sidecars by appending `.sha256` to the ZIM URL, for example
`https://download.kiwix.org/zim/wikipedia/wikipedia_en_100_nopic_2026-04.zim.sha256`.
Ark stores those official checksum links in pack metadata, resolves the published hash before
downloads when network is available, and verifies SHA-256 after download. Small files use Expo
Crypto directly; large ZIM archives use Ark's chunked SHA-256 path so the archive is not loaded into
memory at once.

The content detail screen first tries Ark's native ZIM reader module when an archive is installed.
That path is ready for archive metadata, offline search, main-page loading, and article rendering.
Builds without the native reader keep the Open File/Kiwix handoff.

## Guides

- Hesperian New Where There Is No Doctor, First Aid: `https://hesperian.org/wp-content/uploads/pdf/en_nwtnd_2011/en_nwtnd_2014_03g.pdf`
- Hesperian Where There Is No Doctor, First Aid: `https://hesperian.org/wp-content/uploads/pdf/en_wtnd_2025/en_wtnd_2025_10.pdf`
- US Army FM 21-76 Survival Manual: `https://ia601604.us.archive.org/28/items/Fm21-76SurvivalManual/FM21-76_SurvivalManual.pdf`
- USDA Forest Service wild plant harvest guidance: `https://www.fs.usda.gov/nrs/pubs/gtr/gtr_nrs131.pdf`

## Weather And Feeds

- Open-Meteo forecast API: `https://api.open-meteo.com/v1/forecast`
- FEMA Disaster Declarations RSS: `https://www.fema.gov/feeds/disasters.rss`
- NHC Atlantic Tropical Cyclones RSS: `https://www.nhc.noaa.gov/index-at.xml`
- USGS Significant Earthquakes Atom: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.atom`

Do not ship mushroom identification content without expert local sources and safety review.
