// Kiểm tra "Năng lực máy" (ops-review F1): nói thẳng tính năng nào chạy được trên máy này.
// Env-agnostic: nhận globals qua tham số → unit test bằng Node với fake globals.

/**
 * @param {object} [g=globalThis]
 * @returns {Promise<Array<{id: string, label: string, status: 'available'|'needs-download'|'unavailable'}>>}
 */
export async function checkCapabilities(g = globalThis) {
  const out = [];

  let gpu = 'unavailable';
  try {
    if (g.navigator?.gpu && (await g.navigator.gpu.requestAdapter())) gpu = 'available';
  } catch {
    // giữ unavailable
  }
  out.push({ id: 'webgpu', label: 'WebGPU (tăng tốc phiên âm)', status: gpu });

  const APIS = [
    ['translator', 'Dịch on-device (phụ đề song ngữ)', 'Translator'],
    ['summarizer', 'Tóm tắt on-device (Gemini Nano)', 'Summarizer'],
    ['prompt', 'Copilot đề xuất trả lời (Gemini Nano)', 'LanguageModel'],
  ];
  for (const [id, label, api] of APIS) {
    const A = g[api];
    if (!A?.availability) {
      out.push({ id, label, status: 'unavailable' });
      continue;
    }
    try {
      const a = await A.availability();
      out.push({
        id,
        label,
        status: a === 'available' ? 'available' : a === 'unavailable' ? 'unavailable' : 'needs-download',
      });
    } catch {
      out.push({ id, label, status: 'unavailable' });
    }
  }
  return out;
}

export const STATUS_ICON = { available: '✅', 'needs-download': '⬇️', unavailable: '❌' };
export const STATUS_LABEL = {
  available: 'sẵn sàng',
  'needs-download': 'sẽ tải khi dùng lần đầu',
  unavailable: 'máy/trình duyệt này không hỗ trợ',
};
