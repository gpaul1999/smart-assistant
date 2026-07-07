// Năng lực của từng chế độ nguồn âm (spec 004 FR-039→044). Thuần JS — popup/background/
// offscreen cùng đọc một nguồn chân lý để không lệch hành vi.

export const SOURCE_MODES = ['tab', 'system', 'mic'];

/**
 * @param {'tab'|'system'|'mic'} mode
 * @returns {{needsTab: boolean, needsPicker: boolean, hasSeparation: boolean,
 *   passthrough: boolean, overlayCapable: boolean}}
 *  - needsTab: cần tab http(s) đang mở
 *  - needsPicker: mỗi phiên phải qua picker của trình duyệt (không thể cấp vĩnh viễn)
 *  - hasSeparation: tách được kênh Bạn/Đối phương (nhãn người nói)
 *  - passthrough: phải phát lại nguồn cho user nghe (tab capture mute nguồn; desktop thì không)
 *  - overlayCapable: phụ đề overlay trong tab được (chỉ khi có tab)
 */
export function sourceCapabilities(mode) {
  switch (mode) {
    case 'system':
      return { needsTab: false, needsPicker: true, hasSeparation: true, passthrough: false, overlayCapable: false };
    case 'mic':
      return { needsTab: false, needsPicker: false, hasSeparation: false, passthrough: false, overlayCapable: false };
    case 'tab':
    default:
      return { needsTab: true, needsPicker: false, hasSeparation: true, passthrough: true, overlayCapable: true };
  }
}

/** Ràng buộc mic cho từng chế độ: mic-only phải giữ tiếng loa (EC/NS tắt — FR-041). */
export function micConstraints(mode) {
  return mode === 'mic'
    ? { echoCancellation: false, noiseSuppression: false, autoGainControl: true }
    : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
}
