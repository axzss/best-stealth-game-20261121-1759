// The Gilded Shadow — entry program for make.fun's best stealth game bounty.
//
// The game is plain static files under game/ (game/index.html plus its ES
// modules, no library, no network request) and 3–4 screenshots under
// screenshots/. This program hands the entry in: it copies both folders from
// beside this file into the output directory and writes dossier.json there,
// the summary the judge reads, built by the vendored make.fun library.
//
// Run it locally (outside the grader, MAKEFUN_OUTPUT_DIR stands in for
// /output):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game itself with `node serve.ts` and open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The scorer's caps, mirrored here so a bad entry is refused early instead of
// at grading time: at most 4 screenshots of 256 KiB, at most 993 files and
// 48 MiB under game/, no game/ path over 1000 bytes. game/ counts beside
// /output's own 1000-entry cap, which the screenshots and dossier.json share.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
