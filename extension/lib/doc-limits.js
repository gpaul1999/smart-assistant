// Chính sách kho tài liệu Copilot theo tier (spec 003 amendment D6, 2026-07-06):
// Free: chỉ dán text, TỔNG kho ≤ FREE_TOTAL_CHARS. Pro: nhập file text-format, không giới hạn.
// Thuần JS — docs page + background dùng chung.

export const FREE_TOTAL_CHARS = 3000;

/** Định dạng file Pro nhập được — extract text hoàn toàn local (lib/doc-import.js). */
export const PRO_FILE_EXTENSIONS = [
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'html', 'htm', 'xml',
  'srt', 'vtt', 'log', 'yaml', 'yml',
];

/**
 * Kiểm tra việc thêm nội dung vào kho.
 * @param {{isPro: boolean, existingChars: number, additionChars: number}} p
 * @returns {{allowed: boolean, reason?: 'char-limit', remaining: number}}
 */
export function assessAddition({ isPro, existingChars, additionChars }) {
  if (isPro) return { allowed: true, remaining: Infinity };
  const remaining = Math.max(FREE_TOTAL_CHARS - existingChars, 0);
  if (additionChars > remaining) return { allowed: false, reason: 'char-limit', remaining };
  return { allowed: true, remaining: remaining - additionChars };
}

/**
 * Free chỉ được dán text; Pro nhập file thuộc PRO_FILE_EXTENSIONS.
 * @returns {{allowed: boolean, reason?: 'pro-only'|'unsupported-type'}}
 */
export function canImportFile(fileName, isPro) {
  if (!isPro) return { allowed: false, reason: 'pro-only' };
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  return PRO_FILE_EXTENSIONS.includes(ext)
    ? { allowed: true }
    : { allowed: false, reason: 'unsupported-type' };
}
