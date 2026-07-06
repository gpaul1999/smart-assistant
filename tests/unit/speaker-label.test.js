// Harness SC-008: đo chất lượng nhãn người nói (Bạn/Đối phương/Cả hai) trên hội thoại
// tổng hợp có ground-truth. Mô phỏng thực tế: nguồn đang nói có biên độ lớn, nguồn kia
// vẫn "rò" một ít (echo/leak) — heuristic RMS ratio 1.4x phải vượt ≥90% (SC-008).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Segmenter, rmsOf, labelSpeaker } from '../../extension/lib/segmenter.js';

const SR = 16000;
const BATCH = 2048;

// Kịch bản phỏng vấn luân phiên: [nhãn, số giây] — 'gap' là khoảng lặng để Segmenter cắt.
const SCRIPT = [
  ['them', 3.0], ['gap', 0.7], // câu hỏi
  ['me', 4.0], ['gap', 0.7],   // trả lời
  ['them', 2.0], ['gap', 0.7],
  ['me', 5.0], ['gap', 0.7],
  ['both', 2.0], ['gap', 0.7], // nói chen nhau
  ['them', 3.5], ['gap', 0.7],
  ['me', 2.5], ['gap', 0.7],
  ['them', 1.5], ['gap', 0.7],
  ['me', 3.0], ['gap', 0.7],
  ['both', 1.5], ['gap', 0.7],
];

const VOICE = 0.06; // biên độ nguồn đang nói
const LEAK = 0.012; // rò sang nguồn kia (echo cancellation không tuyệt đối)

// Sóng nói mô phỏng: sin + nhiễu nhẹ để không phải hằng số
function frame(active, seedRef) {
  const out = new Float32Array(BATCH);
  if (!active) {
    for (let i = 0; i < BATCH; i++) out[i] = (rand(seedRef) - 0.5) * 0.001; // noise sàn
    return out;
  }
  for (let i = 0; i < BATCH; i++) {
    out[i] = active * Math.sin((seedRef.t + i) * 0.11) + (rand(seedRef) - 0.5) * 0.004;
  }
  seedRef.t += BATCH;
  return out;
}
function rand(ref) {
  // LCG deterministic
  ref.s = (ref.s * 1664525 + 1013904223) >>> 0;
  return ref.s / 2 ** 32;
}

test('SC-008: nhãn người nói đúng ≥90% trên hội thoại luân phiên có leak', () => {
  const results = [];
  const sg = new Segmenter({
    sr: SR,
    onSegment: ({ mic, tab }) => {
      const label = labelSpeaker(rmsOf(mic), rmsOf(tab));
      if (label) results.push(label); // pipeline thật bỏ đoạn im lặng (null)
    },
  });

  const seed = { s: 42, t: 0 };
  for (const [who, sec] of SCRIPT) {
    const batches = Math.round((sec * SR) / BATCH);
    for (let i = 0; i < batches; i++) {
      const micAmp = who === 'me' || who === 'both' ? VOICE : who === 'them' ? LEAK : 0;
      const tabAmp = who === 'them' || who === 'both' ? VOICE : who === 'me' ? LEAK : 0;
      sg.push(frame(micAmp, seed), frame(tabAmp, seed));
    }
  }
  sg.flush();

  const expected = SCRIPT.filter(([w]) => w !== 'gap').map(([w]) => w);
  // Segmenter có thể cắt một lượt nói dài thành nhiều đoạn (max 10s) — so theo thứ tự
  // bằng cách map từng kết quả về utterance đang diễn ra tại thời điểm đó.
  assert.equal(results.length, expected.length,
    `số đoạn (${results.length}) phải khớp số lượt nói (${expected.length}) với script này`);

  let correct = 0;
  const confusion = {};
  for (let i = 0; i < expected.length; i++) {
    if (results[i] === expected[i]) correct++;
    else confusion[`${expected[i]}→${results[i]}`] = (confusion[`${expected[i]}→${results[i]}`] || 0) + 1;
  }
  const accuracy = correct / expected.length;
  console.log(`SC-008 speaker-label accuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${expected.length})`,
    Object.keys(confusion).length ? confusion : '');
  assert.ok(accuracy >= 0.9, `accuracy ${accuracy} phải ≥ 0.9 (SC-008)`);
});

test('labelSpeaker: các ngưỡng biên', () => {
  assert.equal(labelSpeaker(0.001, 0.002), null, 'cả hai dưới sàn → im lặng');
  assert.equal(labelSpeaker(0.06, 0.01), 'me');
  assert.equal(labelSpeaker(0.01, 0.06), 'them');
  assert.equal(labelSpeaker(0.05, 0.045), 'both', 'chênh dưới 1.4x → cả hai');
});
