// Test demuxer trên fixture sinh bởi CHÍNH MediaRecorder của Chromium
// (scripts/make-fixture.mjs) — và trên file cụt đuôi (mô phỏng khôi phục sau crash).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demuxWebmOpus } from '../../extension/lib/webm-opus.js';

const fixture = new Uint8Array(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../fixtures/sample.webm'))
);

test('demux fixture Chrome MediaRecorder: track Opus + packets + timestamps', () => {
  const out = demuxWebmOpus(fixture);

  assert.equal(out.track.codecId, 'A_OPUS');
  assert.ok(out.track.number >= 1);
  assert.equal(out.track.sampleRate, 48000);
  assert.ok(out.track.channels >= 1);
  assert.ok(out.track.codecPrivate, 'phải có CodecPrivate cho AudioDecoder');
  const head = String.fromCharCode(...out.track.codecPrivate.subarray(0, 8));
  assert.equal(head, 'OpusHead');

  assert.ok(out.packets.length > 50, `packets=${out.packets.length} phải >50 cho ~4s audio`);
  for (const p of out.packets) assert.ok(p.data.length > 0);

  // timestamps không giảm, phủ ~4s
  for (let i = 1; i < out.packets.length; i++) {
    assert.ok(out.packets[i].tsMs >= out.packets[i - 1].tsMs, `ts giảm tại ${i}`);
  }
  assert.ok(out.packets[0].tsMs <= 30, 'packet đầu ~0ms');
  assert.ok(out.durationMs > 3500 && out.durationMs < 4600, `duration=${out.durationMs} phải ~4000ms`);
  assert.equal(out.truncated, false);
});

test('demux file cụt đuôi (crash-recovery prefix) không throw, giữ phần parse được', () => {
  const full = demuxWebmOpus(fixture);
  const cut = demuxWebmOpus(fixture.subarray(0, Math.floor(fixture.length * 0.6)));

  assert.ok(cut.packets.length > 20, 'vẫn ra packets từ prefix');
  assert.ok(cut.packets.length < full.packets.length);
  assert.equal(cut.track.codecId, 'A_OPUS', 'header nằm ở đầu nên track vẫn đọc được');
  // mọi packet của bản cụt phải trùng nội dung với bản đủ
  assert.equal(cut.packets[0].tsMs, full.packets[0].tsMs);
});

test('demux dữ liệu rác không throw', () => {
  const junk = new Uint8Array([0x00, 0xff, 0x12, 0x34, 0x56]);
  const out = demuxWebmOpus(junk);
  assert.equal(out.packets.length, 0);
});
