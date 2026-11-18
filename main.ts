// NEON TIDE v5 — dossier builder. Copies game/ and screenshots/ into the
// output directory, then writes dossier.json with the kit's buildDossier
// (vendor/makefun-game.ts, unchanged). Deterministic: the same tree writes
// the same dossier bytes every run.
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repo = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

if (!existsSync(join(repo, 'game', 'index.html'))) {
  throw new Error('main.ts: game/index.html is missing — nothing to bundle');
}
if (!existsSync(join(repo, 'screenshots'))) {
  throw new Error('main.ts: screenshots/ is missing — take the 4 shots first');
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(repo, 'game'), join(out, 'game'), { recursive: true });
cpSync(join(repo, 'screenshots'), join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`dossier written: ${out}/dossier.json (${dossier.length} bytes)`);
