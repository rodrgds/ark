# Valhalla Native Artifacts

**This directory is no longer used.** ArkRouting now consumes Valhalla as a
prebuilt Maven Central dependency (`io.github.rallista:valhalla-mobile:0.1.1`)
from [Rallista/valhalla-mobile](https://github.com/Rallista/valhalla-mobile).

No CMake cross-compilation, no Valhalla source clone, no Boost/Protobuf setup.

The previous build flow (cross-compile Valhalla from source and drop `.a`/`.so`
files into this directory) was removed in favour of the prebuilt AAR. The build
script at `scripts/build-valhalla-android.mjs` is retained for reference but not
required for normal development.
