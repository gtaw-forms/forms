import { build } from 'esbuild';

await build({
  entryPoints: ['src/utils/identityUtils.js'],
  outfile: 'C:/Users/cross/AppData/Local/Temp/opencode/identityUtils.bundled.mjs',
  format: 'esm',
  bundle: true,
  platform: 'node',
  logLevel: 'silent',
});
console.log('bundled');