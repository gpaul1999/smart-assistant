// Phiên âm bằng Whisper chạy LOCAL qua transformers.js (WASM). Audio không rời máy;
// network duy nhất là tải trọng số model từ HuggingFace lần đầu (cache bằng Cache API).
// vendorUrl trỏ tới extension/vendor/ (bundle transformers.min.js + ort wasm đã vendor).

export const LIVE_MODELS = {
  'Xenova/whisper-tiny': 'Whisper Tiny (nhanh nhất, phù hợp live)',
  'Xenova/whisper-base': 'Whisper Base (cân bằng)',
};
export const ACCURATE_MODELS = {
  'Xenova/whisper-base': 'Whisper Base (cân bằng)',
  'Xenova/whisper-small': 'Whisper Small (chính xác hơn, chậm)',
};

export class Transcriber {
  /**
   * @param {{vendorUrl: string, onProgress?: (info: object) => void}} opts
   */
  constructor({ vendorUrl, onProgress }) {
    this.vendorUrl = vendorUrl;
    this.onProgress = onProgress;
    this._libPromise = null;
    this._pipePromise = null;
    this._model = null;
  }

  _lib() {
    if (!this._libPromise) {
      this._libPromise = import(/* @vite-ignore */ this.vendorUrl + 'transformers.min.js').then(
        (tf) => {
          tf.env.allowLocalModels = false;
          tf.env.backends.onnx.wasm.wasmPaths = this.vendorUrl;
          // Extension page không crossOriginIsolated → không dùng được SharedArrayBuffer/threads
          tf.env.backends.onnx.wasm.numThreads = 1;
          return tf;
        }
      );
    }
    return this._libPromise;
  }

  /**
   * Nạp (hoặc đổi) model. Idempotent theo (model, device).
   * device 'webgpu' lỗi init → tự hạ về 'wasm' (FR-023).
   */
  load(model, { device = 'wasm' } = {}) {
    const key = `${model}|${device}`;
    if (this._key !== key || !this._pipePromise) {
      this._key = key;
      this._pipePromise = this._lib().then((tf) => {
        const make = (dev) =>
          tf.pipeline('automatic-speech-recognition', model, {
            device: dev,
            dtype:
              dev === 'webgpu'
                ? { encoder_model: 'fp16', decoder_model_merged: 'q4' }
                : 'q8',
            progress_callback: (p) => this.onProgress?.(p),
          });
        return device === 'webgpu'
          ? make('webgpu').catch((e) => {
              console.warn('[transcriber] webgpu init lỗi, hạ về wasm:', e.message);
              this._key = `${model}|wasm`;
              return make('wasm');
            })
          : make(device);
      });
    }
    return this._pipePromise;
  }

  /**
   * @param {Float32Array} pcm — mono 16kHz
   * @param {{model: string, language?: string, timestamps?: boolean, device?: string}} opts
   * @returns {Promise<{text: string, chunks?: Array<{text: string, timestamp: [number, number]}>}>}
   */
  async transcribe(pcm, { model, language = 'auto', timestamps = false, device = 'wasm' }) {
    const asr = await this.load(model, { device });
    const opts = { task: 'transcribe' };
    if (language && language !== 'auto') opts.language = language;
    if (timestamps) opts.return_timestamps = true;
    // Audio dài hơn 30s phải chạy theo chunk có stride để không mất chữ ở biên
    if (pcm.length > 30 * 16000) {
      opts.chunk_length_s = 30;
      opts.stride_length_s = 5;
    }
    const out = await asr(pcm, opts);
    return { text: (out.text || '').trim(), chunks: out.chunks };
  }
}

/** Lọc các "ảo giác" hay gặp của Whisper trên đoạn im lặng/nhiễu. */
export function isNoiseTranscript(text) {
  const t = (text || '').trim();
  if (!t) return true;
  if (/^[\s.,!?…\-–—]*$/.test(t)) return true;
  return /^[\[(♪♫]|^(thanks for watching|hãy subscribe|đăng ký kênh|subtitles by|phụ đề bởi)/i.test(t);
}
