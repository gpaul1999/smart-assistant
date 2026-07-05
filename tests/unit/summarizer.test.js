import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitSentences,
  extractiveSummary,
  extractActionItems,
  summarize,
} from '../../extension/lib/summarizer.js';

const MEETING_VI = `
Chào mọi người, hôm nay chúng ta họp về kế hoạch ra mắt sản phẩm quý ba.
Doanh số quý hai đạt một trăm hai mươi phần trăm chỉ tiêu nhờ kênh bán hàng trực tuyến.
Khách hàng phản hồi tính năng báo cáo tự động là điểm mạnh lớn nhất của sản phẩm.
Ừ. Vâng ạ.
Đội kỹ thuật cần hoàn thành tính năng xuất dữ liệu trước ngày mười lăm tháng tám.
Anh Minh phụ trách chuẩn bị tài liệu marketing cho buổi ra mắt.
Chúng ta thống nhất mức giá gói cơ bản là hai trăm nghìn một tháng.
Buổi demo với khách hàng lớn sẽ diễn ra vào tuần sau.
Nhớ gửi biên bản họp cho toàn bộ nhóm sau buổi họp này.
`;

const MEETING_EN = `
Thanks everyone for joining the quarterly review call today.
Revenue grew twenty percent quarter over quarter driven by enterprise deals.
The client asked about the security certification timeline for the new platform.
We will send the updated proposal by Friday.
John needs to follow up with the legal team about the contract renewal.
Next step is to schedule a technical deep dive with their engineering team.
`;

test('splitSentences tách câu tiếng Việt và bỏ dòng rỗng', () => {
  const s = splitSentences(MEETING_VI);
  assert.ok(s.length >= 8);
  assert.ok(s[0].startsWith('Chào mọi người'));
});

test('extractiveSummary trả về tối đa max câu, giữ thứ tự gốc', () => {
  const points = extractiveSummary(MEETING_VI, { max: 4 });
  assert.equal(points.length, 4);
  const all = splitSentences(MEETING_VI);
  const idx = points.map((p) => all.indexOf(p));
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b), 'phải giữ thứ tự xuất hiện');
});

test('extractiveSummary bỏ qua câu đệm ngắn ("Ừ. Vâng ạ.")', () => {
  const points = extractiveSummary(MEETING_VI, { max: 7 });
  assert.ok(!points.some((p) => p === 'Ừ.' || p === 'Vâng ạ.'));
});

test('extractActionItems bắt được action items tiếng Việt', () => {
  const items = extractActionItems(MEETING_VI);
  assert.ok(items.some((i) => i.includes('trước ngày mười lăm tháng tám')));
  assert.ok(items.some((i) => i.includes('phụ trách chuẩn bị tài liệu marketing')));
  assert.ok(items.some((i) => i.includes('Nhớ gửi biên bản họp')));
});

test('extractActionItems bắt được action items tiếng Anh', () => {
  const items = extractActionItems(MEETING_EN);
  assert.ok(items.some((i) => i.includes('will send the updated proposal')));
  assert.ok(items.some((i) => i.toLowerCase().includes('follow up with the legal team')));
  assert.ok(items.some((i) => i.toLowerCase().includes('next step')));
});

test('summarize fallback về extractive khi không có Summarizer API (Node)', async () => {
  const out = await summarize(MEETING_VI);
  assert.equal(out.method, 'extractive');
  assert.ok(out.keyPoints.length > 0);
  assert.ok(out.actionItems.length > 0);
});

test('summarize với text rỗng trả về method none', async () => {
  const out = await summarize('   ');
  assert.equal(out.method, 'none');
  assert.deepEqual(out.keyPoints, []);
});
