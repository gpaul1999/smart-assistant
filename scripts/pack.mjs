// Đóng gói extension thành zip store-ready (spec 002 FR-026).
// npm run pack → dist/smart-meeting-assistant-<version>.zip
import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'extension/manifest.json'), 'utf8'));

// vendor phải tồn tại và mới (store package cần đủ file)
if (!existsSync(join(root, 'extension/vendor/transformers.min.js'))) {
  console.log('vendor thiếu → chạy npm run vendor');
  execSync('node scripts/vendor.mjs', { cwd: root, stdio: 'inherit' });
}

mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', `smart-meeting-assistant-${manifest.version}.zip`);
rmSync(out, { force: true });
// -X: bỏ metadata hệ thống; loại file rác nếu có
execSync(`zip -qrX "${out}" . -x "*.DS_Store" -x "*.map"`, {
  cwd: join(root, 'extension'),
  stdio: 'inherit',
});
console.log('wrote', out);
