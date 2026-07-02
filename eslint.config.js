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
      'docs/.vitepress/dist/**',
      'coverage/**',
      '.agents/**',
    ],
  },
  expoConfig,
  {
    rules: {
      // SDK 57's Expo preset includes stricter React compiler-oriented checks.
      // Keep the existing lint contract until these patterns are migrated deliberately.
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/use-memo': 'off',
    },
  },
  {
    files: ['scripts/**/*.{js,cjs,mjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
