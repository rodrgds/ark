const { withGradleProperties } = require('@expo/config-plugins');

const GRADLE_JVM_ARGS = '-Xmx12g -XX:MaxMetaspaceSize=2048m -Dfile.encoding=UTF-8';

function setGradleProperty(properties, key, value) {
  const existing = properties.find(
    (property) => property.type === 'property' && property.key === key
  );

  if (existing) {
    existing.value = value;
    return properties;
  }

  properties.push({
    type: 'property',
    key,
    value,
  });
  return properties;
}

module.exports = function withArkGradleMemory(config) {
  return withGradleProperties(config, (config) => {
    config.modResults = setGradleProperty(config.modResults, 'org.gradle.jvmargs', GRADLE_JVM_ARGS);
    return config;
  });
};
