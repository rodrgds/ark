#!/usr/bin/env node
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const pbf = process.env.PBF;
const out = process.env.OUT;
const work = resolve(process.env.WORKDIR ?? '.routing-build');
const config = resolve(work, 'valhalla.json');
const tiles = resolve(work, 'tiles');

if (!pbf || !out) {
  fail(
    'Usage:\n' +
      '  PBF=/path/region.osm.pbf OUT=/path/region-valhalla.tar node scripts/build-valhalla-routing-pack.mjs'
  );
}

if (!existsSync(pbf)) fail(`PBF extract not found: ${pbf}`);

rmSync(work, { recursive: true, force: true });
mkdirSync(tiles, { recursive: true });
mkdirSync(dirname(resolve(out)), { recursive: true });

run('valhalla_build_config', ['--mjolnir-tile-dir', tiles, '--mjolnir-tile-extract', out], {
  captureTo: config,
});
run('valhalla_build_tiles', ['-c', config, pbf]);
run('valhalla_build_extract', ['-c', config, '-v']);

console.log(`Routing graph pack written to ${out}`);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.captureTo ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (options.captureTo) {
    writeFileSync(options.captureTo, result.stdout);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
