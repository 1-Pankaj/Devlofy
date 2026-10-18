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
  {
    // Dev tools under `tools/` run in Node against the compiled app, never in
    // the bundle: they get Node's globals and nothing else from the app config.
    files: ['tools/**/*.js'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        require: 'readonly',
      },
    },
  },
]);
