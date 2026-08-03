// The F-Droid flavor (ARK_DISTRIBUTION=fdroid) excludes the optional on-device
// AI native modules so their prebuilt runtimes never enter the F-Droid APK, and
// excludes the Play-Services/Firebase-bearing location and notification modules
// whose classes F-Droid's binary scanner would reject. The standard build
// leaves everything autolinked. JavaScript gets matching shims from
// metro.config.js (AOSP-backed, FOSS), and the app already treats each module
// as optional/unavailable when the native side is missing.

// Note: the AI shims make executoarch/llama behave as unavailable on fdroid;
// the location/notification shims actually provide real behavior (AOSP
// LocationManager + Notifee).
const isFdroid = process.env.ARK_DISTRIBUTION === 'fdroid';

const fdroidExcludedDependencies = isFdroid
  ? {
      'react-native-executorch': { platforms: { android: null, ios: null } },
      'react-native-executorch-expo-resource-fetcher': {
        platforms: { android: null, ios: null },
      },
      'llama.rn': { platforms: { android: null, ios: null } },
      '@react-native-ai/llama': { platforms: { android: null, ios: null } },
      'expo-location': { platforms: { android: null, ios: null } },
      'expo-notifications': { platforms: { android: null, ios: null } },
    }
  : {};

module.exports = {
  dependencies: fdroidExcludedDependencies,
};
