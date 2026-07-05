import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Segmenter, rmsOf, mixdown } from '../../extension/lib/segmenter.js';

const SR = 16000;
const BATCH = 2048; // giống AudioWorklet: ~0.128s mỗi batch

const voiced = () => new Float32Array(BATCH).fill(0.05);
const silent = () => new Float32Array(BATCH);
const zeros = () => new Float32Array(BATCH);

function pushSeconds(sg, seconds, makeFrame) {
  const batches = Math.ceil((seconds * SR) / BATCH);
  for (let i = 0; i < batches; i++) sg.push(makeFrame(), zeros());
  return batches * (BATCH / SR);
}

test('rmsOf và mixdown cơ bản', () => {
  assert.equal(rmsOf(new Float32Array(4)), 0);
  const mixed = mixdown(new Float32Array([0.9]), new Float32Array([0.9]));
  assert.equal(mixed[0], 1, 'phải kẹp về [-1,1]');
});

test('chốt đoạn khi ngắt hơi ~0.45s sau ≥1s nói (độ trễ thấp)', () => {
  const segs = [];
  const sg = new Segmenter({ sr: SR, onSegment: (s) => segs.push(s) });
  pushSeconds(sg, 1.2, voiced);
  assert.equal(segs.length, 0, 'chưa ngắt hơi thì chưa chốt');
  pushSeconds(sg, 0.5, silent);
  assert.equal(segs.length, 1, 'ngắt hơi 0.5s phải chốt câu');
  const seg = segs[0];
  assert.equal(seg.t0, 0);
  assert.ok(seg.t1 >= 1.6 && seg.t1 <= 1.9, `t1=${seg.t1} phải ≈1.7s`);
  assert.equal(seg.len, seg.mic.length);
});

test('ép chốt ở maxSec dù không có khoảng lặng', () => {
  const segs = [];
  const sg = new Segmenter({ sr: SR, maxSec: 10, onSegment: (s) => segs.push(s) });
  pushSeconds(sg, 11, voiced);
  assert.equal(segs.length, 1);
  assert.ok(segs[0].t1 - segs[0].t0 >= 10 && segs[0].t1 - segs[0].t0 < 10.3);
});

test('im lặng hoàn toàn không chốt đoạn rác trước maxSec', () => {
  const segs = [];
  const sg = new Segmenter({ sr: SR, maxSec: 10, onSegment: (s) => segs.push(s) });
  pushSeconds(sg, 5, silent);
  assert.equal(segs.length, 0, 'chưa từng có tiếng nói → không cắt theo khoảng lặng');
});

test('snapshot không reset buffer (dùng cho phụ đề tạm)', () => {
  const sg = new Segmenter({ sr: SR, onSegment: () => {} });
  pushSeconds(sg, 1.2, voiced);
  const a = sg.snapshot();
  assert.ok(a.hadVoice);
  assert.ok(a.len >= SR);
  pushSeconds(sg, 0.256, voiced);
  const b = sg.snapshot();
  assert.ok(b.len > a.len, 'buffer tiếp tục lớn lên sau snapshot');
  assert.equal(b.t0, a.t0, 't0 giữ nguyên cho tới khi chốt');
});

test('sau flush, đoạn kế tiếp có t0 nối tiếp t1 đoạn trước', () => {
  const segs = [];
  const sg = new Segmenter({ sr: SR, onSegment: (s) => segs.push(s) });
  pushSeconds(sg, 1.2, voiced);
  pushSeconds(sg, 0.5, silent);
  pushSeconds(sg, 1.2, voiced);
  pushSeconds(sg, 0.5, silent);
  assert.equal(segs.length, 2);
  assert.equal(segs[1].t0, segs[0].t1);
});
