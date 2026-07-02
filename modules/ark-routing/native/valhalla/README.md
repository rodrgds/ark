# Valhalla Native Artifacts

**This directory is no longer used.** ArkRouting now consumes Valhalla through
[Rallista/valhalla-mobile](https://github.com/Rallista/valhalla-mobile):
Android uses the Maven Central dependency
`io.github.rallista:valhalla-mobile:0.1.1` while Ark is on Kotlin 2.1.x, and iOS attaches the `Valhalla`
Swift Package product to the app target during CocoaPods post-install before
calling its `ValhallaObjc` wrapper dynamically from `ArkRoutingModule.swift`.

No CMake cross-compilation, no Valhalla source clone, no Boost/Protobuf setup.

The previous build flow (cross-compile Valhalla from source and drop `.a`/`.so`
files into this directory) was removed in favour of upstream mobile artifacts.
The build script at `scripts/build-valhalla-android.mjs` is retained for
reference but not required for normal development.
