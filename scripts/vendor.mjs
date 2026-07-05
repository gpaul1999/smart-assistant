// Copy transformers.js + ONNX Runtime WASM từ node_modules vào extension/vendor/.
// Extension MV3 không được load code từ CDN nên phải vendor các file này.
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/@huggingface/transformers/dist');
const dst = join(root, 'extension/vendor');

const FILES = [
  'transformers.min.js',
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
];

mkdirSync(dst, { recursive: true });
for (const f of FILES) {
  cpSync(join(src, f), join(dst, f));
  console.log('vendored', f);
}
