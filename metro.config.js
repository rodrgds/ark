const { getDefaultConfig } = require('expo/metro-config');
const { getBundleModeMetroConfig } = require('react-native-worklets/bundleMode');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm');
config.resolver.assetExts.push('pte');
config.resolver.assetExts.push('bin');

const defaultBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : config.resolver.blockList
    ? [config.resolver.blockList]
    : [];

config.resolver.blockList = [...defaultBlockList, /\.test\.[tj]sx?$/, /\.spec\.[tj]sx?$/];

module.exports = withUniwindConfig(getBundleModeMetroConfig(config), {
  // relative path to your global.css file (from previous step)
  cssEntryFile: './global.css',
  extraThemes: ['oled'],
  // (optional) path where we gonna auto-generate typings
  // defaults to project's root
  dtsFile: './uniwind-types.d.ts',
});
