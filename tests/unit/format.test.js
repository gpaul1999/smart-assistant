import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uid, secToClock, buildMarkdown } from '../../extension/lib/format.js';

test('uid sinh id khác nhau', () => {
  assert.notEqual(uid(), uid());
});

test('secToClock format mm:ss và h:mm:ss', () => {
  assert.equal(secToClock(0), '00:00');
  assert.equal(secToClock(65.7), '01:05');
  assert.equal(secToClock(3600 + 125), '1:02:05');
  assert.equal(secToClock(-5), '00:00');
});

test('buildMarkdown chứa đủ các phần', () => {
  const md = buildMarkdown({
    title: 'Phỏng vấn Frontend',
    startedAt: 1750000000000,
    durationMs: 125000,
    targetLang: 'vi',
    summary: {
      method: 'extractive',
      keyPoints: ['Ứng viên có 5 năm kinh nghiệm React'],
      keyPointsTranslated: ['Bản dịch điểm 1'],
      actionItems: ['Gửi bài test về nhà trước thứ sáu'],
    },
    segments: [
      { t0: 0, t1: 5, speaker: 'them', text: 'Tell me about yourself', translation: 'Hãy giới thiệu về bản thân' },
      { t0: 5, t1: 12, speaker: 'me', text: 'I have five years of experience' },
    ],
  });
  assert.ok(md.includes('# Phỏng vấn Frontend'));
  assert.ok(md.includes('## Tóm tắt điểm chính'));
  assert.ok(md.includes('- Ứng viên có 5 năm kinh nghiệm React'));
  assert.ok(md.includes('- [ ] Gửi bài test về nhà trước thứ sáu'));
  assert.ok(md.includes('**Đối phương:** Tell me about yourself'));
  assert.ok(md.includes('_Hãy giới thiệu về bản thân_'));
  assert.ok(md.includes('**Bạn:** I have five years of experience'));
});

test('buildMarkdown không vỡ khi meeting rỗng', () => {
  const md = buildMarkdown({ title: 'X', startedAt: 0 });
  assert.ok(md.includes('# X'));
});
