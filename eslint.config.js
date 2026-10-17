// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.agents/**', '.expo/**', 'node_modules/**'],
  },
  {
    // React Three Fiber JSX intrinsics (mesh, cylinderGeometry, …) are not DOM
    // elements — the rule cannot know them.
    files: ['src/components/garden/**/*.tsx'],
    rules: {
      'react/no-unknown-property': 'off',
    },
  },
]);
