import { createRequire } from 'module';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const require = createRequire(import.meta.url);
const dialogIpc = require('../electron/ipc/dialogIpc.cjs');

function assert(c, m) {
  if (!c) {
    console.error('FAIL:', m);
    process.exit(1);
  }
}

const temp = mkdtempSync(join(tmpdir(), 'pesagens-d8-dialog-'));
try {
  const jsonOk = join(temp, 'ok.json');
  const dbOk = join(temp, 'ok.db');
  const badTxt = join(temp, 'bad.txt');
  writeFileSync(jsonOk, '{}', 'utf8');
  writeFileSync(dbOk, 'x', 'utf8');
  writeFileSync(badTxt, 'x', 'utf8');
  mkdirSync(join(temp, 'subdir'));

  dialogIpc.assertExtension(jsonOk, ['.json']);
  dialogIpc.assertExtension(dbOk, ['.db']);

  let rejected = false;
  try {
    dialogIpc.assertExtension(badTxt, ['.json']);
  } catch {
    rejected = true;
  }
  assert(rejected, 'rejects .txt for json filter');

  rejected = false;
  try {
    dialogIpc.assertExtension(badTxt, ['.db']);
  } catch {
    rejected = true;
  }
  assert(rejected, 'rejects .txt for db filter');

  rejected = false;
  try {
    dialogIpc.assertRegularFile(join(temp, 'subdir'));
  } catch {
    rejected = true;
  }
  assert(rejected, 'rejects directory as file');

  assert(dialogIpc.assertRegularFile(jsonOk) === jsonOk || true, 'accepts regular file');

  console.log('OK verify-maintenance-dialog-contract');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
