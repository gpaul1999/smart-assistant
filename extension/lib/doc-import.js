// Trích văn bản từ file text-format — hoàn toàn LOCAL (spec 003 D6, Constitution I).
// Tinh thần markitdown (convert mọi thứ → text đọc được) nhưng bằng JS thuần vì extension
// không ship được Python và không được gửi tài liệu ra ngoài. PDF/DOCX: phase sau
// (pdf.js vendor / DecompressionStream), cũng sẽ local.

/** Bóc HTML/XML → text: bỏ script/style, thẻ, decode entity cơ bản, gọn khoảng trắng. */
export function stripMarkup(raw) {
  return (raw || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

/** SRT/VTT → text: bỏ header, số thứ tự cue, dòng timestamp; gộp lời thoại. */
export function stripCues(raw) {
  return (raw || '')
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t || t === 'WEBVTT') return false;
      if (/^\d+$/.test(t)) return false; // số thứ tự cue
      if (/\d{1,2}:\d{2}(:\d{2})?[.,]\d{3}\s*-->\s*/.test(t)) return false; // timestamp
      if (/^(NOTE|STYLE|REGION)\b/.test(t)) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * @param {string} fileName
 * @param {string} raw — nội dung file (đã đọc bằng file.text() phía UI)
 * @returns {string} văn bản sạch để chunk + index
 */
export function extractText(fileName, raw) {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (['html', 'htm', 'xml'].includes(ext)) return stripMarkup(raw);
  if (['srt', 'vtt'].includes(ext)) return stripCues(raw);
  return (raw || '').trim(); // txt/md/csv/tsv/json/log/yaml — giữ nguyên
}
