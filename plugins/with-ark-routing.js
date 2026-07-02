const { createRunOncePlugin, withPodfile } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const pkg = require('../package.json');

const TAG = 'ark-routing:post-install';

function withArkRouting(config) {
  return withPodfile(config, (config) => {
    const result = mergeContents({
      tag: TAG,
      src: config.modResults.contents,
      newSrc: '    $ARK_ROUTING.post_install(installer)',
      anchor: /post_install do \|installer\|/,
      offset: 1,
      comment: '#',
    });

    config.modResults.contents =
      result.didMerge || result.didClear ? result.contents : config.modResults.contents;
    return config;
  });
}

module.exports = createRunOncePlugin(withArkRouting, 'ark-routing', pkg.version);
