// Truy hồi trích đoạn từ kho tài liệu (spec 003 FR-032/033/034, research R1).
// Chunk ~1200 ký tự chồng lấn 200 + BM25 thuần JS. Xuyên ngôn ngữ: query gồm câu hỏi
// gốc + bản dịch (pipeline có sẵn). Điểm dưới ngưỡng → im lặng (không nhiễu, không bịa).

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;
const K1 = 1.5;
const B = 0.75;

/** Cắt văn bản thành đoạn, ưu tiên ngắt ở ranh giới câu/xuống dòng. */
export function chunkText(text, { size = CHUNK_SIZE, overlap = CHUNK_OVERLAP } = {}) {
  const clean = (text || '').replace(/\r\n/g, '\n').trim();
  if (!clean) return [];
  const chunks = [];
  let pos = 0;
  while (pos < clean.length) {
    let end = Math.min(pos + size, clean.length);
    if (end < clean.length) {
      // lùi về ranh giới câu gần nhất trong 40% cuối chunk
      const slice = clean.slice(pos, end);
      const cut = Math.max(
        slice.lastIndexOf('\n'),
        slice.lastIndexOf('. '),
        slice.lastIndexOf('? '),
        slice.lastIndexOf('! ')
      );
      if (cut > size * 0.6) end = pos + cut + 1;
    }
    chunks.push({ text: clean.slice(pos, end).trim(), offset: pos });
    if (end >= clean.length) break;
    pos = Math.max(end - overlap, pos + 1);
  }
  return chunks.filter((c) => c.text.length > 0);
}

export function tokenize(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((w) => w.length > 1);
}

/**
 * Xây chỉ mục BM25 từ danh sách đoạn.
 * @param {Array<{text: string, docId?: string, docTitle?: string, offset?: number}>} chunks
 */
export function buildIndex(chunks) {
  const docs = chunks.map((c) => ({ ...c, tokens: tokenize(c.text) }));
  const df = new Map();
  for (const d of docs) {
    for (const t of new Set(d.tokens)) df.set(t, (df.get(t) || 0) + 1);
  }
  const avgLen = docs.reduce((n, d) => n + d.tokens.length, 0) / (docs.length || 1);
  return { docs, df, avgLen, N: docs.length };
}

/**
 * BM25 search. Query có thể là nhiều biến thể (gốc + bản dịch) — điểm lấy max theo biến thể.
 * @returns {Array<{chunk, score}>} tối đa k kết quả trên ngưỡng minScore
 */
export function search(index, queries, { k = 3, minScore = 1.5 } = {}) {
  const qs = (Array.isArray(queries) ? queries : [queries]).filter(Boolean);
  if (!index?.N || !qs.length) return [];

  const scores = new Array(index.N).fill(0);
  for (const q of qs) {
    const qTokens = new Set(tokenize(q));
    for (let i = 0; i < index.N; i++) {
      const d = index.docs[i];
      const tf = new Map();
      for (const t of d.tokens) if (qTokens.has(t)) tf.set(t, (tf.get(t) || 0) + 1);
      let s = 0;
      for (const [t, f] of tf) {
        const n = index.df.get(t) || 0;
        const idf = Math.log(1 + (index.N - n + 0.5) / (n + 0.5));
        s += (idf * (f * (K1 + 1))) / (f + K1 * (1 - B + (B * d.tokens.length) / index.avgLen));
      }
      if (s > scores[i]) scores[i] = s; // max theo biến thể query
    }
  }

  return scores
    .map((score, i) => ({ chunk: index.docs[i], score }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
