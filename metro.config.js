const { getDefaultConfig } = require('expo/metro-config');
const { getBundleModeMetroConfig } = require('react-native-worklets/bundleMode');
const { withUniwindConfig } = require('uniwind/metro');
const path = require('node:path');

const config = getDefaultConfig(__dirname);
const bundleMode = process.env.ARK_DISABLE_WORKLETS_BUNDLE_MODE !== '1';
config.resolver.assetExts.push('wasm');
config.resolver.assetExts.push('pte');
config.resolver.assetExts.push('bin');

const defaultBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : config.resolver.blockList
    ? [config.resolver.blockList]
    : [];

config.resolver.blockList = [...defaultBlockList, /\.test\.[tj]sx?$/, /\.spec\.[tj]sx?$/];

const webRuntimeShims = {
  '@swmansion/react-native-bottom-sheet': path.resolve(
    __dirname,
    'src/shims/react-native-bottom-sheet.web.ts'
  ),
  'expo-secure-store': path.resolve(__dirname, 'src/shims/expo-secure-store.web.ts'),
  'react-native-executorch': path.resolve(__dirname, 'src/shims/react-native-executorch.web.ts'),
  'react-native-executorch-expo-resource-fetcher': path.resolve(
    __dirname,
    'src/shims/react-native-executorch-resource-fetcher.web.ts'
  ),
  'react-native-audio-api': path.resolve(__dirname, 'src/shims/react-native-audio-api.web.ts'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && webRuntimeShims[moduleName]) {
    return { filePath: webRuntimeShims[moduleName], type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

const enhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, metroServer) => {
  const enhanced = enhanceMiddleware ? enhanceMiddleware(middleware, metroServer) : middleware;
  return (request, response, next) => {
    response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return enhanced(request, response, next);
  };
};

module.exports = withUniwindConfig(bundleMode ? getBundleModeMetroConfig(config) : config, {
  // relative path to your global.css file (from previous step)
  cssEntryFile: './global.css',
  extraThemes: ['oled'],
  // (optional) path where we gonna auto-generate typings
  // defaults to project's root
  dtsFile: './uniwind-types.d.ts',
});
