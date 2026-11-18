// NEON TIDE v5 — main.ts (entrypoint gta6-01, Node 22, stdlib only).
// Menyalin game/ + screenshots/ dari repo ke /output (atau MAKEFUN_OUTPUT_DIR)
// lalu menulis /output/dossier.json dengan buildDossier dari vendor kit.
// Ditulis fresh di sesi builder v5; pola mengikuti starter kit main.ts.
// Revisi v5: guard existsSync untuk screenshots/ supaya run tetap jalan,
// plus log ringkas ukuran dossier ke stderr untuk verifikasi determinisme.
// Revisi v5.2: log juga dicetak saat MAKEFUN_OUTPUT_DIR dipakai (bukan hanya /output).
import { cpSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Caps gate: teks dossier 160 KiB, maks 4 screenshot @256 KiB,
// game maks 993 file / 48 MiB / path 1000 byte.
const dossierPath = join(out, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.error(`NEON TIDE v5 dossier written: ${dossierPath} (${statSync(dossierPath).size} bytes)`);
