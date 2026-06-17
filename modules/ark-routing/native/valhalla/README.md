# Valhalla Native Artifacts

Do not commit compiled Valhalla binaries here.

Use this directory as a local drop-in target for generated artifacts:

```text
modules/ark-routing/native/valhalla/
  include/
  android/
    arm64-v8a/
      lib/
```

Then build with:

```sh
cd android
./gradlew :ark-routing:assembleDebug --no-daemon \
  -PreactNativeArchitectures=arm64-v8a \
  -ParkRoutingValhallaDir=$PWD/../modules/ark-routing/native/valhalla
```
