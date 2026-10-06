'use strict';
const path = require('node:path');
const { buildSync } = require('esbuild');

// Vercel disables require(ESM). Bundle the renderer and its parser dependencies
// into CommonJS while preserving the current sanitizer's security fixes.
buildSync({
  absWorkingDir: path.resolve(__dirname, '..'),
  entryPoints: ['server/blog-render.js'],
  outfile: 'generated/blog-render.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  logLevel: 'info'
});
