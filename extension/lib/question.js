// Phát hiện câu hỏi trong câu chốt của "Đối phương" (spec 003 FR-032). Heuristic vi/en,
// thuần JS. Whisper thường giữ dấu '?' nhưng không phải luôn → thêm từ nghi vấn.

const VI_INTERROG =
  /(^|\P{L})(ai|gì|sao|tại sao|vì sao|thế nào|như thế nào|bao nhiêu|bao lâu|khi nào|lúc nào|ở đâu|đâu|nào|hả|hử|không|chưa|à|ạ|nhỉ|được không|phải không|đúng không|hay không)(\?|\s|$)/iu;
const EN_INTERROG =
  /^(what|who|whom|whose|which|when|where|why|how|do|does|did|can|could|would|will|shall|should|is|are|was|were|have|has|had|may|might|tell me|walk me|describe|explain)\b/i;

/** @returns {boolean} câu này có phải câu hỏi không */
export function isQuestion(text) {
  const t = (text || '').trim();
  if (t.length < 4) return false;
  if (t.endsWith('?')) return true;
  if (EN_INTERROG.test(t)) return true;
  // vi: từ nghi vấn ở cuối câu là tín hiệu mạnh ("... được không", "... thế nào")
  const tail = t.slice(-25).toLowerCase();
  if (/(không|chưa|nhỉ|hả|thế nào|ra sao|bao nhiêu|khi nào|ở đâu|là gì|phải không|đúng không)\s*[.!…]*$/u.test(tail)) {
    return true;
  }
  return VI_INTERROG.test(t) && t.split(/\s+/).length <= 20; // câu ngắn chứa từ nghi vấn
}

/**
 * Ghép cặp hỏi–đáp từ transcript cho rà soát sau buổi (FR-034, research R3):
 * câu hỏi = segment 'them' là câu hỏi; câu trả lời = các segment 'me'/'both' liền sau
 * cho tới câu hỏi kế tiếp.
 * @param {Array<{speaker: string, text: string, t0: number}>} segments
 * @returns {Array<{question: object, answers: object[]}>}
 */
export function pairQA(segments) {
  const pairs = [];
  let current = null;
  for (const seg of segments || []) {
    const isQ = seg.speaker === 'them' && isQuestion(seg.text);
    if (isQ) {
      current = { question: seg, answers: [] };
      pairs.push(current);
    } else if (current && (seg.speaker === 'me' || seg.speaker === 'both')) {
      current.answers.push(seg);
    }
  }
  return pairs;
}
