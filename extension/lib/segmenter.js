// Cắt luồng PCM (mic + tab) thành đoạn theo khoảng lặng — tối ưu cho độ trễ thấp:
// chốt câu khi người nói ngắt ~0.45s (sau tối thiểu 1s) hoặc đủ maxSec.
// snapshot() cho phép phiên âm "tạm" (interim) trên buffer đang tích lũy mà không reset.
// Thuần JS, không phụ thuộc môi trường → unit test được bằng Node.

export function rmsOf(a) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * a[i];
  return Math.sqrt(sum / (a.length || 1));
}

/** Trộn mic + tab thành mono, kẹp về [-1, 1]. */
export function mixdown(mic, tab) {
  const out = new Float32Array(mic.length);
  for (let i = 0; i < mic.length; i++) out[i] = Math.max(-1, Math.min(1, mic[i] + tab[i]));
  return out;
}

function concat(arrays, total) {
  const out = new Float32Array(total);
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

export class Segmenter {
  constructor({
    sr = 16000,
    minSpeechSec = 1,
    silenceSec = 0.45,
    maxSec = 10,
    silenceRms = 0.008,
    onSegment,
  } = {}) {
    this.sr = sr;
    this.minSpeechSec = minSpeechSec;
    this.silenceSec = silenceSec;
    this.maxSec = maxSec;
    this.silenceRms = silenceRms;
    this.onSegment = onSegment;
    this.mic = [];
    this.tab = [];
    this.len = 0;
    this.silenceSamples = 0;
    this.hadVoice = false;
    this.absSample = 0;
    this.startSample = 0;
  }

  push(mic, tab) {
    this.mic.push(mic);
    this.tab.push(tab);
    this.len += mic.length;
    this.absSample += mic.length;

    const rms = rmsOf(mixdown(mic, tab));
    if (rms < this.silenceRms) {
      this.silenceSamples += mic.length;
    } else {
      this.silenceSamples = 0;
      this.hadVoice = true;
    }

    const dur = this.len / this.sr;
    const sil = this.silenceSamples / this.sr;
    if ((this.hadVoice && dur >= this.minSpeechSec && sil >= this.silenceSec) || dur >= this.maxSec) {
      this.flush();
    }
  }

  /** Bản chụp buffer hiện tại (không reset) — dùng cho phụ đề tạm. */
  snapshot() {
    if (!this.len) return null;
    return {
      mic: concat(this.mic, this.len),
      tab: concat(this.tab, this.len),
      t0: this.startSample / this.sr,
      t1: this.absSample / this.sr,
      len: this.len,
      hadVoice: this.hadVoice,
    };
  }

  /** Chốt đoạn hiện tại (nếu có) và reset buffer. */
  flush() {
    if (!this.len) return;
    const seg = this.snapshot();
    this.mic = [];
    this.tab = [];
    this.len = 0;
    this.silenceSamples = 0;
    this.hadVoice = false;
    this.startSample = this.absSample;
    this.onSegment?.(seg);
  }
}
