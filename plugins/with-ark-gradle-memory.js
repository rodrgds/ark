const { withGradleProperties } = require('@expo/config-plugins');

function intEnv(raw, fallback) {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

// Local development defaults match Ark's native-heavy build needs. The
// F-Droid build environment overrides these via ARK_GRADLE_* so a shared
// public build recipe does not inherit a 12 GiB heap.
const GRADLE_XMX_MB = intEnv(process.env.ARK_GRADLE_XMX_MB, 12288);
const GRADLE_MAX_METASPACE_MB = intEnv(process.env.ARK_GRADLE_MAX_METASPACE_MB, 2048);
const GRADLE_WORKERS = process.env.ARK_GRADLE_WORKERS?.trim() || undefined;
const GRADLE_PARALLEL = process.env.ARK_GRADLE_PARALLEL?.trim() || undefined;

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
    setGradleProperty(
      config.modResults,
      'org.gradle.jvmargs',
      `-Xmx${GRADLE_XMX_MB}m -XX:MaxMetaspaceSize=${GRADLE_MAX_METASPACE_MB}m -Dfile.encoding=UTF-8`
    );
    if (GRADLE_WORKERS) {
      setGradleProperty(config.modResults, 'org.gradle.workers.max', GRADLE_WORKERS);
    }
    if (GRADLE_PARALLEL) {
      setGradleProperty(config.modResults, 'org.gradle.parallel', GRADLE_PARALLEL);
    }
    return config;
  });
};
