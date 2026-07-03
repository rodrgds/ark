const { createRunOncePlugin, withAppBuildGradle } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const pkg = require('../package.json');

const SIGNING_TAG = 'ark-android-release-signing';
const SPLITS_TAG = 'ark-android-release-apk-splits';

const SIGNING_HELPERS = `def arkReleaseStoreFile = System.getenv("ARK_ANDROID_KEYSTORE_PATH")
def arkReleaseStorePassword = System.getenv("ARK_ANDROID_KEYSTORE_PASSWORD")
def arkReleaseKeyAlias = System.getenv("ARK_ANDROID_KEY_ALIAS")
def arkReleaseKeyPassword = System.getenv("ARK_ANDROID_KEY_PASSWORD")
def arkReleaseSigningConfigured = [
    arkReleaseStoreFile,
    arkReleaseStorePassword,
    arkReleaseKeyAlias,
    arkReleaseKeyPassword
].every { value -> value != null && value.toString().trim() }`;

const RELEASE_SIGNING_CONFIG = `        release {
            if (arkReleaseSigningConfigured) {
                storeFile file(arkReleaseStoreFile)
                storePassword arkReleaseStorePassword
                keyAlias arkReleaseKeyAlias
                keyPassword arkReleaseKeyPassword
            }
        }`;

const APK_SPLITS_CONFIG = `    splits {
        abi {
            reset()
            enable true
            universalApk true
            include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
        }
    }`;

function mergeTagged(contents, { tag, newSrc, anchor, offset = 0 }) {
  const result = mergeContents({
    tag,
    src: contents,
    newSrc,
    anchor,
    offset,
    comment: '//',
  });

  return result.didMerge || result.didClear ? result.contents : contents;
}

function withArkAndroidRelease(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      return config;
    }

    let contents = config.modResults.contents;
    contents = mergeTagged(contents, {
      tag: SIGNING_TAG,
      newSrc: SIGNING_HELPERS,
      anchor: /android\s*\{/,
      offset: 0,
    });
    contents = mergeTagged(contents, {
      tag: SPLITS_TAG,
      newSrc: APK_SPLITS_CONFIG,
      anchor: /android\s*\{/,
      offset: 1,
    });
    contents = mergeTagged(contents, {
      tag: `${SIGNING_TAG}-config`,
      newSrc: RELEASE_SIGNING_CONFIG,
      anchor: /signingConfigs\s*\{/,
      offset: 1,
    });
    contents = contents.replace(
      `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`,
      `        release {
            // CI release builds use ARK_ANDROID_* signing secrets when present.
            signingConfig arkReleaseSigningConfigured ? signingConfigs.release : signingConfigs.debug`
    );

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = createRunOncePlugin(withArkAndroidRelease, 'ark-android-release', pkg.version);
