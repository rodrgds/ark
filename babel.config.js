module.exports = function (api) {
  api.cache(true);
  const bundleMode = process.env.ARK_DISABLE_WORKLETS_BUNDLE_MODE !== '1';
  return {
    presets: [['babel-preset-expo']],
    plugins: [['react-native-reanimated/plugin', { bundleMode }]],
  };
};
