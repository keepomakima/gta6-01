// NEON TIDE v7 "Golden Hour" — main.ts (entry program, Node 22, stdlib only)
// Hands the game in: copies game/ and screenshots/ from beside this file to
// /output and writes /output/dossier.json with the vendored make.fun library
// (vendor/makefun-game.ts, unchanged from the kit). Outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The game itself is plain static files under game/ (three.js vendored as
// game/vendor/three.min.js, no network request) that desktop Chrome plays
// offline from game/index.html. Serve it locally with `node serve.ts`.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's caps (see the kit's RULES.txt): text_max_bytes shapes the
// dossier text; the other caps refuse an entry the scorer would refuse
// (more than 4 screenshots or one over 256 KiB; game/ over 993 files or
// 48 MiB, or a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
// NEON TIDE v7 "Golden Hour" — main.ts (entry program, Node 22, stdlib only)
// One more note for the next builder: the dossier is deterministic — the
// same game/ and screenshots/ always produce the same dossier.json bytes,
// so run it twice with different MAKEFUN_OUTPUT_DIR values and compare
// sha256 hashes to prove it before submitting.
// v7-coverfix: cover re-stage
