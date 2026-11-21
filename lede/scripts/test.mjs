// Bundles each *.test.ts with esbuild (ships with Vite) and runs it in Node.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'lede-test-'));
for (const t of ['src/lib/tax.test.ts', 'src/lib/starling.test.ts', 'src/lib/trends.test.ts']) {
  const out = join(dir, t.replace(/\W/g, '_') + '.mjs');
  await build({ entryPoints: [t], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error' });
  execFileSync(process.execPath, [out], { stdio: 'inherit' });
}
