import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickModels, canRealtime } from '../../extension/lib/model-policy.js';

test('WebGPU + base nhanh → live base, accurate small', () => {
  const out = pickModels({ device: 'webgpu', rtfTiny: 0.1, rtfBase: 0.3 });
  assert.equal(out.liveModel, 'Xenova/whisper-base');
  assert.equal(out.accurateModel, 'Xenova/whisper-small');
});

test('WebGPU nhưng base chậm → live tiny', () => {
  const out = pickModels({ device: 'webgpu', rtfTiny: 0.2, rtfBase: 0.8 });
  assert.equal(out.liveModel, 'Xenova/whisper-tiny');
});

test('WASM máy thường → tiny/base', () => {
  const out = pickModels({ device: 'wasm', rtfTiny: 0.6, rtfBase: 1.8 });
  assert.equal(out.liveModel, 'Xenova/whisper-tiny');
  assert.equal(out.accurateModel, 'Xenova/whisper-base');
});

test('WASM máy rất khỏe (base RTF ≤0.35) → live base', () => {
  const out = pickModels({ device: 'wasm', rtfTiny: 0.15, rtfBase: 0.3 });
  assert.equal(out.liveModel, 'Xenova/whisper-base');
});

test('canRealtime', () => {
  assert.equal(canRealtime({ rtfTiny: 0.4 }), true);
  assert.equal(canRealtime({ rtfTiny: 1.5 }), false);
  assert.equal(canRealtime({ rtfTiny: NaN }), false);
});
