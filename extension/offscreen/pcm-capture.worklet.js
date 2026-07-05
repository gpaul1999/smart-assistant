// AudioWorklet: gom PCM của 2 nguồn (input 0 = mic, input 1 = tab) và gửi về main thread
// theo lô ~128ms để phiên âm live + phân biệt người nói theo năng lượng từng nguồn.
const BATCH = 2048; // mẫu @16kHz ≈ 128ms

class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.mic = new Float32Array(BATCH);
    this.tab = new Float32Array(BATCH);
    this.filled = 0;
  }

  process(inputs) {
    const mic = inputs[0]?.[0];
    const tab = inputs[1]?.[0];
    const n = (mic || tab || { length: 128 }).length;

    for (let i = 0; i < n; i++) {
      this.mic[this.filled] = mic ? mic[i] : 0;
      this.tab[this.filled] = tab ? tab[i] : 0;
      this.filled++;
      if (this.filled === BATCH) {
        const m = this.mic.slice();
        const t = this.tab.slice();
        this.port.postMessage({ mic: m, tab: t }, [m.buffer, t.buffer]);
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor('pcm-capture', PcmCapture);
