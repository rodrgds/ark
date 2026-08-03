const { createRunOncePlugin, withSettingsGradle } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const pkg = require('../package.json');

// F-Droid rejects Google Play Services and Firebase classes in the APK. The
// location/notification native modules that carry those deps (expo-location,
// expo-notifications) are excluded from Expo autolinking for the fdroid
// distribution only; JS keeps working via the AOSP-backed shims in
// metro.config.js. The exclusion is runtime-conditional so Play/dev builds
// still link the full modules.
const TAG = 'ark-fdroid-autolink-exclude';

const FDROID_EXCLUDE = `if (System.getenv('ARK_DISTRIBUTION') == 'fdroid') {
  expoAutolinking.exclude = ['expo-location', 'expo-notifications']
}`;

function withArkFdroidAutolink(config) {
  return withSettingsGradle(config, (config) => {
    const result = mergeContents({
      tag: TAG,
      src: config.modResults.contents,
      newSrc: FDROID_EXCLUDE,
      anchor: /expoAutolinking\.useExpoModules\(\)/,
      offset: 0,
      comment: '//',
    });

    config.modResults.contents =
      result.didMerge || result.didClear ? result.contents : config.modResults.contents;
    return config;
  });
}

module.exports = createRunOncePlugin(withArkFdroidAutolink, 'ark-fdroid-autolink', pkg.version);
