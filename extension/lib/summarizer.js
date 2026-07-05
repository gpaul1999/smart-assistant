// Tóm tắt cuộc họp — ưu tiên Chrome Summarizer API (Gemini Nano, chạy on-device),
// fallback sang thuật toán extractive thuần JS. Cả hai đường đều 100% local.

const STOPWORDS = new Set([
  // vi
  'và', 'là', 'của', 'có', 'cho', 'các', 'một', 'này', 'đó', 'với', 'được', 'thì', 'mà', 'ở',
  'trong', 'khi', 'cũng', 'như', 'để', 'không', 'những', 'lại', 'nên', 'vì', 'nhé', 'ạ', 'à',
  'ừ', 'ờ', 'vâng', 'dạ', 'rồi', 'thôi', 'nhưng', 'nếu', 'hay', 'hoặc', 'em', 'anh', 'chị',
  'mình', 'bạn', 'tôi', 'ta', 'nó', 'họ', 'gì', 'sao', 'thế', 'vậy', 'đây', 'kia', 'đi', 'ra',
  'vào', 'lên', 'xuống', 'về', 'từ', 'theo', 'đến', 'bị', 'bởi', 'ấy', 'cái', 'con', 'việc',
  // en
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'of', 'to', 'in', 'on', 'at', 'for', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it', 'its', 'this', 'that', 'these',
  'those', 'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your', 'his', 'her', 'our', 'their',
  'so', 'just', 'like', 'yeah', 'yes', 'no', 'ok', 'okay', 'um', 'uh', 'well', 'do', 'does',
  'did', 'have', 'has', 'had', 'not', 'as', 'by', 'from', 'about', 'up', 'down', 'out', 'me',
]);

const ACTION_PATTERNS = [
  // vi — không dùng \b vì word boundary của JS chỉ hiểu ASCII, hỏng với ký tự có dấu
  /(?:^|\P{L})(cần|phải|sẽ (?:làm|gửi|chuẩn bị|hoàn thành|liên hệ|báo cáo)|giao cho|phụ trách|deadline|hạn chót|trước ngày|trước thứ|nhớ|đừng quên|chốt lại|thống nhất)(?!\p{L})/iu,
  // en
  /\b(action item|todo|to-do|follow[- ]?up|next step|will (send|do|prepare|share|schedule|contact)|need(s)? to|should|due (by|on)|assign(ed)?|deliverable|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week|eod|eow))\b/i,
];

export function splitSentences(text) {
  return (text || '')
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function tokenize(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(
    (w) => w.length > 1 && !STOPWORDS.has(w)
  );
}

/**
 * Tóm tắt extractive: chấm điểm câu theo tần suất từ khoá (bỏ stopword vi/en),
 * lấy top `max` câu, giữ nguyên thứ tự xuất hiện.
 */
export function extractiveSummary(text, { max = 7 } = {}) {
  const sentences = splitSentences(text).filter((s) => tokenize(s).length >= 3);
  if (sentences.length <= max) return sentences;

  const freq = new Map();
  for (const s of sentences) {
    for (const w of tokenize(s)) freq.set(w, (freq.get(w) || 0) + 1);
  }
  const scored = sentences.map((s, i) => {
    const words = tokenize(s);
    const score = words.reduce((acc, w) => acc + (freq.get(w) || 0), 0) / Math.sqrt(words.length);
    return { s, i, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
}

/** Nhặt các câu giống "việc cần làm" (vi + en). */
export function extractActionItems(text, { max = 10 } = {}) {
  const out = [];
  for (const s of splitSentences(text)) {
    if (s.length < 8) continue;
    if (ACTION_PATTERNS.some((re) => re.test(s))) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('summarizer timeout')), ms)),
  ]);
}

/**
 * Tóm tắt chính: thử Chrome Summarizer API (on-device) trước, lỗi/không có/quá `timeoutMs`
 * (vd. kẹt tải model Gemini Nano) thì extractive. Trả về { method, keyPoints, actionItems }.
 */
export async function summarize(text, { onProgress, timeoutMs = 90_000 } = {}) {
  const clean = (text || '').trim();
  if (!clean) return { method: 'none', keyPoints: [], actionItems: [] };

  const actionItems = extractActionItems(clean);

  if (typeof globalThis.Summarizer !== 'undefined') {
    try {
      const out = await withTimeout(
        (async () => {
          const availability = await globalThis.Summarizer.availability();
          if (availability === 'unavailable') return null;
          const s = await globalThis.Summarizer.create({
            type: 'key-points',
            format: 'plain-text',
            length: 'medium',
            monitor(m) {
              m.addEventListener('downloadprogress', (e) => onProgress?.(e.loaded));
            },
          });
          const result = await s.summarize(clean);
          s.destroy?.();
          return result;
        })(),
        timeoutMs
      );
      if (out) {
        const keyPoints = out
          .split('\n')
          .map((l) => l.replace(/^[-*•\s]+/, '').trim())
          .filter(Boolean);
        if (keyPoints.length) return { method: 'gemini-nano', keyPoints, actionItems };
      }
    } catch {
      // rơi xuống extractive
    }
  }
  return { method: 'extractive', keyPoints: extractiveSummary(clean), actionItems };
}
