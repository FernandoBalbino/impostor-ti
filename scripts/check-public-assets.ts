import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { CATALOG } from '../apps/server/src/catalog.js';
import { ALL_POWER_IDS, POWER_IDS } from '@impostor/shared';
const base = process.env.SITE_URL ?? 'https://fernandobalbino.github.io/impostor-ti/';
const paths = [
  ...new Set([
    ...CATALOG.map((w) => w.imagem),
    ...ALL_POWER_IDS.map((id) => `assets/powers/${id}.webp`),
  ]),
];
const results: { path: string; ok: boolean; status: number }[] = [];
for (let offset = 0; offset < paths.length; offset += 6) {
  await Promise.all(
    paths.slice(offset, offset + 6).map(async (path) => {
      const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30000) });
      const data = Buffer.from(await response.arrayBuffer());
      const local = await readFile(new URL(`../apps/web/public/${path}`, import.meta.url));
      const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex');
      results.push({
        path,
        ok: response.ok && hash(data) === hash(local),
        status: response.status,
      });
    }),
  );
}
const report = {
  base,
  words: CATALOG.length,
  powers: ALL_POWER_IDS.length,
  selectablePowers: POWER_IDS.length,
  uniqueAssets: paths.length,
  failed: results.filter((r) => !r.ok),
  checkedAt: new Date().toISOString(),
};
await mkdir('qa-evidence', { recursive: true });
await writeFile('qa-evidence/public-assets.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.failed.length) process.exitCode = 1;
