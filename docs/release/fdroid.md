# F-Droid Preparation

Ark is being prepared for F-Droid, but the first F-Droid submission still needs a real `fdroidserver` build and scanner pass.

## What Is In The Repo Now

- Android package ID: `app.ark.offline`
- Android `versionCode`: `1`
- FOSS license: MIT
- Fastlane metadata under `fastlane/metadata/android/en-US/`
- Draft fdroiddata metadata under `fdroid/metadata/app.ark.offline.yml`
- No Firebase, Google Mobile Services, ads, or analytics packages in `package.json`

## F-Droid Constraints That Matter For Ark

F-Droid requires public source code, a FOSS license, FOSS dependencies, command-line buildability, and store metadata. React Native apps also need extra scanner work because JavaScript dependencies can contain prebuilt `.jar`, `.aar`, or `.so` artifacts.

References:

- [Submitting to F-Droid Quick Start Guide](https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/)
- [F-Droid Build Metadata Reference](https://f-droid.org/en/docs/Build_Metadata_Reference/)
- [F-Droid Inclusion Policy](https://f-droid.org/docs/Inclusion_Policy/)
- [Adding React Native Apps to F-Droid](https://f-droid.org/en/2020/10/14/adding-react-native-app-to-f-droid.html)

## Expected Scanner Hot Spots

- Expo and React Native generated native dependencies
- `llama.rn` native artifacts
- ExecuTorch native artifacts
- MapLibre native dependencies
- Skia native artifacts
- `valhalla-mobile` routing library
- ArkZim and CoreKiwix/libkiwix artifacts

These may be acceptable if they are FOSS and traceable, but F-Droid packaging will need precise `scanignore`, `scandelete`, or source-build adjustments after scanner output is available.

## Likely Submission Flow

1. Cut a tagged Android release candidate.
2. Run `bun install --frozen-lockfile`.
3. Run `expo prebuild --platform android --no-install --no-clean`.
4. Test `fdroidserver` metadata against the generated Android project.
5. Resolve scanner findings.
6. Submit a merge request to `fdroiddata`.

## Possible F-Droid Flavor Work

If scanner output rejects optional native AI/routing dependencies, create an F-Droid build path that disables or patches those packages while keeping maps, guides, notes, backups, tools, and imported documents working. Do this only from actual scanner evidence.
