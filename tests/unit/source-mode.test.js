import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceCapabilities, micConstraints, SOURCE_MODES } from '../../extension/lib/source-mode.js';

test('tab: cần tab, có separation, passthrough (tabCapture mute nguồn), overlay được', () => {
  const c = sourceCapabilities('tab');
  assert.deepEqual(c, { needsTab: true, needsPicker: false, hasSeparation: true, passthrough: true, overlayCapable: true });
});

test('system: picker mỗi phiên, KHÔNG passthrough (tránh vọng), vẫn có separation', () => {
  const c = sourceCapabilities('system');
  assert.equal(c.needsPicker, true);
  assert.equal(c.passthrough, false);
  assert.equal(c.hasSeparation, true);
  assert.equal(c.overlayCapable, false);
});

test('mic: một chạm (không picker/tab), KHÔNG separation', () => {
  const c = sourceCapabilities('mic');
  assert.equal(c.needsTab, false);
  assert.equal(c.needsPicker, false);
  assert.equal(c.hasSeparation, false);
});

test('mode lạ → mặc định tab (an toàn)', () => {
  assert.equal(sourceCapabilities('xyz').needsTab, true);
});

test('micConstraints: mic-only tắt EC/NS để giữ tiếng loa (FR-041)', () => {
  assert.equal(micConstraints('mic').echoCancellation, false);
  assert.equal(micConstraints('mic').noiseSuppression, false);
  assert.equal(micConstraints('tab').echoCancellation, true);
  assert.equal(micConstraints('system').echoCancellation, true);
});

test('SOURCE_MODES đủ 3 chế độ', () => {
  assert.deepEqual(SOURCE_MODES, ['tab', 'system', 'mic']);
});
