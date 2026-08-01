// React Native CLI configuration.
//
// The F-Droid flavor (ARK_DISTRIBUTION=fdroid) excludes the optional on-device
// AI native modules so their prebuilt runtimes never enter the F-Droid APK.
// The standard build leaves everything autolinked. JavaScript gets matching
// no-op shims from metro.config.js, and the app already treats each module as
// optional/unavailable when the native side is missing.
const isFdroid = process.env.ARK_DISTRIBUTION === 'fdroid';

const fdroidExcludedDependencies = isFdroid
  ? {
      'react-native-executorch': { platforms: { android: null, ios: null } },
      'react-native-executorch-expo-resource-fetcher': {
        platforms: { android: null, ios: null },
      },
      'llama.rn': { platforms: { android: null, ios: null } },
      '@react-native-ai/llama': { platforms: { android: null, ios: null } },
    }
  : {};

module.exports = {
  dependencies: fdroidExcludedDependencies,
};
