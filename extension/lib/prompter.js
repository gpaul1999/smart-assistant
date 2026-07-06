// Tổng hợp câu trả lời GROUNDED từ trích đoạn bằng Prompt API (Gemini Nano, on-device) —
// spec 003 FR-033/034, quyết định D5: cấm bịa, mọi ý truy về nguồn.
// Phần build/parse prompt thuần (test bằng Node); phần gọi LanguageModel guard globalThis.

export const NO_EVIDENCE = 'KHONG_DU_CAN_CU';

/** Prompt ép grounded-only: chỉ dùng trích đoạn, thiếu → trả đúng sentinel. */
export function buildAnswerPrompt({ question, excerpts, targetLang }) {
  const lang = targetLang || 'vi';
  const list = excerpts
    .map((e, i) => `[${i + 1}] (${e.docTitle || 'tài liệu'}) ${e.text}`)
    .join('\n\n');
  return [
    `Bạn là trợ lý trả lời CHỈ dựa trên trích đoạn tài liệu cho sẵn.`,
    `LUẬT BẮT BUỘC:`,
    `1. Chỉ dùng thông tin có trong các trích đoạn đánh số dưới đây. TUYỆT ĐỐI không thêm kiến thức ngoài.`,
    `2. Sau mỗi ý phải ghi nguồn dạng [1], [2].`,
    `3. Nếu trích đoạn không đủ để trả lời, trả về DUY NHẤT chuỗi: ${NO_EVIDENCE}`,
    `4. Trả lời ngắn gọn 2-4 câu, bằng ngôn ngữ "${lang}".`,
    ``,
    `TRÍCH ĐOẠN:`,
    list,
    ``,
    `CÂU HỎI: ${question}`,
    ``,
    `TRẢ LỜI:`,
  ].join('\n');
}

/**
 * Parse output của Nano → {text, citations[]} hoặc null nếu không đủ căn cứ / vi phạm luật.
 * Ý không kèm citation nào → coi như vi phạm grounding → null (an toàn hơn hiển thị).
 */
export function parseAnswer(raw, excerptCount) {
  const t = (raw || '').trim();
  if (!t || t.includes(NO_EVIDENCE)) return null;
  const cited = [...t.matchAll(/\[(\d+)\]/g)]
    .map((m) => Number(m[1]))
    .filter((n) => n >= 1 && n <= excerptCount);
  if (!cited.length) return null; // không truy vết được nguồn → không hiển thị (D5)
  return { text: t, citations: [...new Set(cited)] };
}

let sessionPromise = null;

/** Có Prompt API (Gemini Nano) không — offscreen/viewer gọi để bật/tắt tầng tổng hợp. */
export function promptApiAvailable() {
  return typeof globalThis.LanguageModel !== 'undefined';
}

async function getSession() {
  if (!promptApiAvailable()) return null;
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const availability = await globalThis.LanguageModel.availability();
      if (availability === 'unavailable') return null;
      return globalThis.LanguageModel.create();
    })().catch(() => null);
  }
  return sessionPromise;
}

/**
 * Sinh câu trả lời grounded. Trả null khi: không có Nano / không đủ căn cứ / mất grounding.
 * @param {{question: string, excerpts: Array<{text, docTitle}>, targetLang?: string, timeoutMs?: number}} p
 */
export async function synthesizeAnswer({ question, excerpts, targetLang, timeoutMs = 8000 }) {
  if (!excerpts?.length) return null;
  const session = await getSession();
  if (!session) return null;
  try {
    const raw = await Promise.race([
      session.prompt(buildAnswerPrompt({ question, excerpts, targetLang })),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
    ]);
    return parseAnswer(raw, excerpts.length);
  } catch {
    return null;
  }
}

/** Đánh giá một cặp hỏi–đáp so với tài liệu (rà soát sau buổi — FR-034). */
export function buildReviewPrompt({ question, answerText, excerpts, targetLang }) {
  const lang = targetLang || 'vi';
  const list = excerpts.map((e, i) => `[${i + 1}] ${e.text}`).join('\n\n');
  return [
    `Đối chiếu câu trả lời của ứng viên với tài liệu tham chiếu. Chỉ dùng trích đoạn cho sẵn.`,
    `Trả về 3 dòng, bằng ngôn ngữ "${lang}":`,
    `KHOP: (ý đúng với tài liệu, kèm [n]; nếu không có ghi "-")`,
    `LECH: (ý sai/khác tài liệu, kèm [n]; nếu không có ghi "-")`,
    `THIEU: (ý quan trọng trong tài liệu chưa được nhắc, kèm [n]; nếu không có ghi "-")`,
    ``,
    `TRÍCH ĐOẠN:`,
    list,
    ``,
    `CÂU HỎI: ${question}`,
    `TRẢ LỜI CỦA ỨNG VIÊN: ${answerText || '(không trả lời)'}`,
  ].join('\n');
}

export async function reviewAnswer({ question, answerText, excerpts, targetLang, timeoutMs = 15000 }) {
  if (!excerpts?.length) return null;
  const session = await getSession();
  if (!session) return null;
  try {
    const raw = await Promise.race([
      session.prompt(buildReviewPrompt({ question, answerText, excerpts, targetLang })),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
    ]);
    return (raw || '').trim() || null;
  } catch {
    return null;
  }
}
