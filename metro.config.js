const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite loads a WebAssembly build of SQLite (wa-sqlite) on web.
config.resolver.assetExts.push('wasm');

// wa-sqlite uses SharedArrayBuffer, which browsers only expose to cross-origin
// isolated pages. Development responses get COOP/COEP here so `npm run web`
// works; a deployed build needs the same headers from the host (configured for
// EAS Hosting in app.json, see docs/03-architecture.md for static hosts).
const enhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const wrapped = enhanceMiddleware ? enhanceMiddleware(middleware, server) : middleware;
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    return wrapped(req, res, next);
  };
};

module.exports = config;
