// "Xuất chẩn đoán" (ops-review F6): không telemetry (Constitution I) nên bù bằng file
// chẩn đoán LOCAL do user chủ động xuất và tự gửi khi báo lỗi. Thuần JS.

export const MAX_ERRORS = 20;

/** Thêm lỗi vào ring buffer (mảng đã lưu trong storage) — trả mảng mới, tối đa MAX_ERRORS. */
export function appendError(errlog, message) {
  const next = [...(errlog || []), { ts: Date.now(), message: String(message).slice(0, 500) }];
  return next.slice(-MAX_ERRORS);
}

/**
 * Gom chẩn đoán thành object JSON-able. KHÔNG chứa nội dung cuộc họp/tài liệu —
 * chỉ metadata kỹ thuật để debug.
 */
export function buildDiagnostics({ version, settings, capabilities, errlog, meetingsCount, storage }) {
  const { bench, liveModel, accurateModel, sourceMode, captionMode, targetLang, sourceLang } =
    settings || {};
  return {
    generatedAt: new Date().toISOString(),
    version: version || 'unknown',
    settings: { bench, liveModel, accurateModel, sourceMode, captionMode, targetLang, sourceLang },
    capabilities: capabilities || [],
    storage: storage || null, // {usage, quota}
    meetingsCount: meetingsCount ?? null,
    errors: errlog || [],
  };
}
