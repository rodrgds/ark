const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');
const globals = require('globals');

module.exports = defineConfig([
  {
    ignores: [
      '.expo/**',
      'android/**',
      'ios/**',
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '.agents/**',
    ],
  },
  expoConfig,
  {
    files: ['scripts/**/*.{js,cjs,mjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
