---
layout: home
hero:
  name: Ark
  text: Offline survival computer
  tagline: Maps, knowledge, private notes, local source search, and field tools for phones that still need to work after the network is gone.
  image:
    light: /ark-logo.png
    dark: /ark-logo-dark.png
    alt: Ark mark
  actions:
    - theme: brand
      text: Start Using Ark
      link: /user/getting-started
    - theme: alt
      text: Developer Setup
      link: /developer/setup
features:
  - title: Prepare Before You Lose Signal
    details: Download maps, routing packs, guides, ZIM archives, model files, and RSS/weather caches while you still have bandwidth.
  - title: Keep Private Data Local
    details: Notes, documents, chats, tracks, saved places, and backups stay on device unless you export or share them.
  - title: Inspect What Is Ready
    details: Settings and Diagnostics separate offline readiness, native runtime availability, storage state, and recovery paths.
---

## Screens

<div class="screenshot-grid">
  <img src="/screenshots/library.png" alt="Ark Library screen" />
  <img src="/screenshots/map.png" alt="Ark Map screen" />
</div>

## Choose Your Path

<div class="callout-grid">
  <div>
    <h3>User guide</h3>
    <p>Set up downloads, maps, vault protection, local source search, and field tools without reading implementation details.</p>
    <p><a href="/user/getting-started">Open the user guide</a></p>
  </div>
  <div>
    <h3>Developer guide</h3>
    <p>Work on the Expo app, native modules, data model, CI, release gates, and distribution paths.</p>
    <p><a href="/developer/setup">Open the developer guide</a></p>
  </div>
</div>

## Current Release Posture

Ark publishes installable Android APKs through GitHub Releases. Core flows exist, but store-ready production still needs full device proof for the native-heavy paths: SQLCipher, MapLibre offline packs, Valhalla routing, background track recording, ArkZim, ArkOcr, llama.rn, and ExecuTorch source-search models.

Use the [release checklist](/release/release-checklist) before presenting Ark as production-ready.
