// Tests cho các lib Copilot (spec 003): retrieval BM25, question detection, prompter,
// db v3 docsets. SC-016 (grounding): parseAnswer từ chối output không citation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { chunkText, buildIndex, search } from '../../extension/lib/retrieval.js';
import { isQuestion, pairQA } from '../../extension/lib/question.js';
import { buildAnswerPrompt, parseAnswer, NO_EVIDENCE } from '../../extension/lib/prompter.js';

// ---------- retrieval

const CONTRACT = `Điều 5. Bảo hành. Bên B bảo hành sản phẩm trong 24 tháng kể từ ngày nghiệm thu.
Trong thời gian bảo hành, lỗi phát sinh do nhà sản xuất được sửa chữa miễn phí trong 7 ngày làm việc.

Điều 6. Thanh toán. Bên A thanh toán 30% giá trị hợp đồng khi ký, 70% còn lại trong 30 ngày
sau nghiệm thu. Thanh toán chậm chịu lãi 0.05% mỗi ngày.

Điều 7. Bảo mật. Hai bên cam kết không tiết lộ thông tin của nhau cho bên thứ ba trong 5 năm.`;

const SPEC_EN = `Performance. Version 2.0 processes 4,800 requests per second on the reference
hardware, a 3x improvement over version 1.x. Cold start latency is under 120 milliseconds.

Deployment. The service ships as a single container image and requires PostgreSQL 15 or newer.`;

test('chunkText: cắt theo ranh giới câu, có chồng lấn', () => {
  const long = Array.from({ length: 60 }, (_, i) => `Câu số ${i} nói về điều khoản ${i}.`).join(' ');
  const chunks = chunkText(long, { size: 300, overlap: 50 });
  assert.ok(chunks.length > 3);
  for (const c of chunks) assert.ok(c.text.length <= 320);
  // chồng lấn: đầu chunk sau nằm trong chunk trước
  assert.ok(chunks[0].text.includes(chunks[1].text.slice(0, 20)) || chunks[1].offset < chunks[0].offset + 300);
});

test('BM25 tìm đúng điều khoản theo câu hỏi tiếng Việt', () => {
  const chunks = [
    ...chunkText(CONTRACT, { size: 250, overlap: 40 }).map((c) => ({ ...c, docTitle: 'Hợp đồng ACME' })),
    ...chunkText(SPEC_EN, { size: 250, overlap: 40 }).map((c) => ({ ...c, docTitle: 'Spec v2' })),
  ];
  const index = buildIndex(chunks);
  const hits = search(index, ['Thời gian bảo hành sản phẩm là bao lâu?'], { k: 2 });
  assert.ok(hits.length >= 1);
  assert.ok(hits[0].chunk.text.includes('bảo hành'), hits[0].chunk.text);
  assert.equal(hits[0].chunk.docTitle, 'Hợp đồng ACME');
});

test('BM25 xuyên ngôn ngữ: hỏi tiếng Việt + bản dịch tiếng Anh → trúng tài liệu tiếng Anh', () => {
  const index = buildIndex(chunkText(SPEC_EN, { size: 250, overlap: 40 }));
  const noTranslation = search(index, ['Phiên bản 2.0 xử lý bao nhiêu yêu cầu mỗi giây?'], { k: 2 });
  const withTranslation = search(
    index,
    ['Phiên bản 2.0 xử lý bao nhiêu yêu cầu mỗi giây?', 'How many requests per second does version 2.0 process?'],
    { k: 2 }
  );
  assert.ok(withTranslation.length >= 1, 'có bản dịch phải tìm ra');
  assert.ok(withTranslation[0].chunk.text.includes('4,800'));
  assert.ok(withTranslation[0].score >= (noTranslation[0]?.score || 0));
});

test('câu hỏi ngoài tài liệu → dưới ngưỡng, im lặng (FR-034/SC-016)', () => {
  const index = buildIndex(chunkText(CONTRACT, { size: 250, overlap: 40 }));
  const hits = search(index, ['Thời tiết hôm nay thế nào nhỉ?'], { k: 3 });
  assert.equal(hits.length, 0);
});

// ---------- question detection

test('isQuestion: vi/en, có và không có dấu hỏi', () => {
  assert.equal(isQuestion('Bạn có thể giới thiệu về bản thân không?'), true);
  assert.equal(isQuestion('Điều khoản bảo hành trong hợp đồng là gì'), true);
  assert.equal(isQuestion('Anh xử lý tình huống đó thế nào'), true);
  assert.equal(isQuestion('What is your biggest weakness'), true);
  assert.equal(isQuestion('Tell me about yourself'), true);
  assert.equal(isQuestion('Cảm ơn bạn đã tham gia buổi họp hôm nay.'), false);
  assert.equal(isQuestion('Chúng tôi sẽ gửi kết quả sau một tuần.'), false);
});

test('pairQA ghép hỏi–đáp theo thứ tự', () => {
  const pairs = pairQA([
    { speaker: 'them', text: 'Bạn có kinh nghiệm React không?', t0: 0 },
    { speaker: 'me', text: 'Tôi có 5 năm kinh nghiệm.', t0: 5 },
    { speaker: 'me', text: 'Chủ yếu làm dashboard.', t0: 9 },
    { speaker: 'them', text: 'Rất ấn tượng.', t0: 14 },
    { speaker: 'them', text: 'Mức lương mong muốn của bạn là bao nhiêu?', t0: 18 },
    { speaker: 'me', text: 'Khoảng 30 triệu.', t0: 22 },
  ]);
  assert.equal(pairs.length, 2);
  assert.equal(pairs[0].answers.length, 2);
  assert.ok(pairs[1].question.text.includes('lương'));
  assert.equal(pairs[1].answers.length, 1);
});

// ---------- prompter (phần thuần — SC-016 grounding)

test('buildAnswerPrompt chứa luật grounded + trích đoạn đánh số', () => {
  const p = buildAnswerPrompt({
    question: 'Bảo hành bao lâu?',
    excerpts: [{ text: 'bảo hành 24 tháng', docTitle: 'HĐ' }],
    targetLang: 'vi',
  });
  assert.ok(p.includes(NO_EVIDENCE));
  assert.ok(p.includes('[1] (HĐ) bảo hành 24 tháng'));
  assert.ok(p.includes('không thêm kiến thức ngoài'));
});

test('parseAnswer: có citation → nhận; không citation hoặc NO_EVIDENCE → null', () => {
  assert.deepEqual(parseAnswer('Bảo hành 24 tháng [1].', 2), {
    text: 'Bảo hành 24 tháng [1].',
    citations: [1],
  });
  assert.equal(parseAnswer('Bảo hành 24 tháng.', 2), null, 'không citation → từ chối (D5)');
  assert.equal(parseAnswer(NO_EVIDENCE, 2), null);
  assert.equal(parseAnswer('Có thể là 12 tháng [9].', 2), null, 'citation ngoài phạm vi → từ chối');
  assert.equal(parseAnswer('', 2), null);
});

// ---------- db v3

test('docsets/docs CRUD + deleteDocSet xóa docs con', async () => {
  const db = await import('../../extension/lib/db.js');
  await db.putDocSet({ id: 'ds1', name: 'Khách ACME', createdAt: 1 });
  await db.putDoc({ id: 'd1', docsetId: 'ds1', title: 'Hợp đồng', content: CONTRACT });
  await db.putDoc({ id: 'd2', docsetId: 'ds1', title: 'Spec', content: SPEC_EN });
  await db.putDoc({ id: 'd3', docsetId: 'khac', title: 'X', content: 'y' });

  assert.equal((await db.listDocSets())[0].name, 'Khách ACME');
  assert.equal((await db.listDocs('ds1')).length, 2);

  await db.deleteDocSet('ds1');
  assert.equal((await db.listDocSets()).length, 0);
  assert.equal((await db.listDocs('ds1')).length, 0);
  assert.equal((await db.listDocs('khac')).length, 1, 'không đụng docset khác');
});
