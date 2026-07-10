// Tests gói A ops-hardening: capabilities (F1), diag (F6), SRT/VTT (A6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCapabilities } from '../../extension/lib/capabilities.js';
import { appendError, buildDiagnostics, MAX_ERRORS } from '../../extension/lib/diag.js';
import { buildSrt, buildVtt, secToTimestamp } from '../../extension/lib/format.js';

test('checkCapabilities: máy đầy đủ → available/needs-download đúng', async () => {
  const g = {
    navigator: { gpu: { requestAdapter: async () => ({}) } },
    Translator: { availability: async () => 'available' },
    Summarizer: { availability: async () => 'downloadable' },
    LanguageModel: { availability: async () => 'unavailable' },
  };
  const caps = await checkCapabilities(g);
  const by = Object.fromEntries(caps.map((c) => [c.id, c.status]));
  assert.equal(by.webgpu, 'available');
  assert.equal(by.translator, 'available');
  assert.equal(by.summarizer, 'needs-download');
  assert.equal(by.prompt, 'unavailable');
});

test('checkCapabilities: máy trống trơn → tất cả unavailable, không throw', async () => {
  const caps = await checkCapabilities({});
  assert.equal(caps.length, 4);
  assert.ok(caps.every((c) => c.status === 'unavailable'));
});

test('appendError: ring buffer tối đa MAX_ERRORS, cắt message dài', () => {
  let log = [];
  for (let i = 0; i < MAX_ERRORS + 5; i++) log = appendError(log, `lỗi ${i}`);
  assert.equal(log.length, MAX_ERRORS);
  assert.equal(log[log.length - 1].message, `lỗi ${MAX_ERRORS + 4}`);
  const long = appendError([], 'x'.repeat(1000));
  assert.equal(long[0].message.length, 500);
});

test('buildDiagnostics: KHÔNG chứa nội dung họp/tài liệu, chỉ metadata', () => {
  const d = buildDiagnostics({
    version: '0.6.0',
    settings: { bench: { device: 'wasm', rtfTiny: 0.4 }, liveModel: 'x', targetLang: 'vi', copilotDocsetId: 'ds-secret' },
    capabilities: [{ id: 'webgpu', status: 'unavailable' }],
    errlog: [{ ts: 1, message: 'e' }],
    meetingsCount: 3,
    storage: { usage: 1, quota: 2 },
  });
  assert.equal(d.version, '0.6.0');
  assert.equal(d.meetingsCount, 3);
  assert.equal(d.settings.copilotDocsetId, undefined, 'không rò id kho tài liệu');
  assert.ok(!JSON.stringify(d).includes('ds-secret'));
});

test('secToTimestamp + buildSrt/buildVtt', () => {
  assert.equal(secToTimestamp(3661.5), '01:01:01,500');
  assert.equal(secToTimestamp(0.25, '.'), '00:00:00.250');

  const meeting = {
    segments: [
      { t0: 0, t1: 2.5, text: 'Hello', translation: 'Xin chào' },
      { t0: 3, t1: 5, text: 'Goodbye' },
    ],
  };
  const srt = buildSrt(meeting);
  assert.ok(srt.startsWith('1\n00:00:00,000 --> 00:00:02,500\nHello\nXin chào'));
  assert.ok(srt.includes('2\n00:00:03,000 --> 00:00:05,000\nGoodbye'));

  const vtt = buildVtt(meeting);
  assert.ok(vtt.startsWith('WEBVTT'));
  assert.ok(vtt.includes('00:00:00.000 --> 00:00:02.500'));
  assert.equal(buildSrt({ segments: [] }), '');
});
