// Chọn model Whisper theo kết quả benchmark máy (spec 002 FR-022/FR-023, research R2).
// Thuần JS — offscreen đo RTF rồi gọi hàm này; user override được trong Nâng cao.

/** RTF (real-time factor) tối đa cho phụ đề live: chừa nửa quỹ thời gian cho dịch + UI. */
export const LIVE_RTF_MAX = 0.5;

/**
 * @param {{device: 'webgpu'|'wasm', rtfTiny: number, rtfBase?: number|null}} bench
 * @returns {{liveModel: string, accurateModel: string}}
 */
export function pickModels({ device, rtfTiny, rtfBase = null }) {
  // WebGPU: đủ nhanh cho base live trên đa số máy; accurate lên small
  if (device === 'webgpu') {
    const liveModel =
      rtfBase != null && rtfBase <= LIVE_RTF_MAX ? 'Xenova/whisper-base' : 'Xenova/whisper-tiny';
    return { liveModel, accurateModel: 'Xenova/whisper-small' };
  }
  // WASM: tiny trừ khi máy rất khỏe
  if (rtfBase != null && rtfBase <= LIVE_RTF_MAX * 0.7) {
    return { liveModel: 'Xenova/whisper-base', accurateModel: 'Xenova/whisper-small' };
  }
  if (!Number.isFinite(rtfTiny) || rtfTiny > 1.2) {
    // máy quá yếu: vẫn tiny nhưng báo kỳ vọng chậm (UI đọc canRealtime)
    return { liveModel: 'Xenova/whisper-tiny', accurateModel: 'Xenova/whisper-base' };
  }
  return { liveModel: 'Xenova/whisper-tiny', accurateModel: 'Xenova/whisper-base' };
}

/** Máy có giữ được phụ đề "gần realtime" không (để UI nói thẳng kỳ vọng). */
export function canRealtime({ rtfTiny }) {
  return Number.isFinite(rtfTiny) && rtfTiny <= 1.0;
}
