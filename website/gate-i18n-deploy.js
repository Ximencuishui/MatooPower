#!/usr/bin/env node
/**
 * Matoo Power · Pre-deploy i18n gate.
 *
 * Runs the canonical sequence of pre-deploy i18n checks and fixes.
 * Returns non-zero exit code if any check fails. Idempotent — running
 * twice should yield zero changes.
 *
 * Pipeline:
 *   1. prune-mojibake.js          (clean JSON files)
 *   2. prune-mojibake-html.js     (clean HTML inline blocks)
 *   3. backfill-missing-i18n-keys.js  (fill missing with en fallback)
 *   4. _audit_i18n_deploy.js      (verify all 12 pages x 14 languages)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname);

function run(label, cmd, args) {
  console.log('\n=== ' + label + ' ===');
  const t0 = Date.now();
  let exitCode = 0;
  try {
    const out = cp.spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: true });
    exitCode = out.status;
  } catch (e) {
    console.error('  [error] ' + label + ': ' + e.message);
    exitCode = 1;
  }
  const dt = Date.now() - t0;
  console.log('  [' + (exitCode === 0 ? 'OK' : 'FAIL') + '] ' + label + ' (' + dt + 'ms)');
  return exitCode;
}

const steps = [
  { label: '1/4 prune JSON files', cmd: 'node', args: ['prune-mojibake.js'] },
  { label: '2/4 prune HTML blocks', cmd: 'node', args: ['prune-mojibake-html.js'] },
  { label: '3/4 backfill missing keys', cmd: 'node', args: ['backfill-missing-i18n-keys.js'] },
  { label: '4/4 audit', cmd: 'node', args: ['_audit_i18n_deploy.js'] },
];

let failed = 0;
for (const s of steps) {
  const code = run(s.label, s.cmd, s.args);
  if (code !== 0) failed++;
}

console.log('\n=== Gate summary ===');
if (failed > 0) {
  console.error('FAILED: ' + failed + ' step(s) returned non-zero.');
  process.exit(1);
} else {
  console.log('PASSED: all 4 steps succeeded.');
  process.exit(0);
}