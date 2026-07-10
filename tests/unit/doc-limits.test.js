import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessAddition, canImportFile, FREE_TOTAL_CHARS } from '../../extension/lib/doc-limits.js';
import { extractText, stripMarkup, stripCues } from '../../extension/lib/doc-import.js';

// ---- doc-limits (D6: free ≤3000 ký tự tổng, Pro không giới hạn)

test('free: trong hạn mức 3000 ký tự tổng → cho phép, tính remaining đúng', () => {
  const out = assessAddition({ isPro: false, existingChars: 1000, additionChars: 1500 });
  assert.equal(out.allowed, true);
  assert.equal(out.remaining, FREE_TOTAL_CHARS - 1000 - 1500);
});

test('free: vượt hạn mức → chặn kèm remaining', () => {
  const out = assessAddition({ isPro: false, existingChars: 2900, additionChars: 200 });
  assert.equal(out.allowed, false);
  assert.equal(out.reason, 'char-limit');
  assert.equal(out.remaining, 100);
});

test('pro: không giới hạn ký tự', () => {
  const out = assessAddition({ isPro: true, existingChars: 9e6, additionChars: 9e6 });
  assert.equal(out.allowed, true);
});

test('canImportFile: free không nhập file; Pro theo whitelist định dạng', () => {
  assert.equal(canImportFile('cv.md', false).reason, 'pro-only');
  assert.equal(canImportFile('cv.md', true).allowed, true);
  assert.equal(canImportFile('hopdong.HTML', true).allowed, true);
  assert.equal(canImportFile('scan.pdf', true).reason, 'unsupported-type'); // phase sau
  assert.equal(canImportFile('video.mp4', true).reason, 'unsupported-type');
});

// ---- doc-import (convert local, tinh thần markitdown)

test('stripMarkup: bỏ script/style/thẻ, giữ nội dung, decode entity', () => {
  const html = `<html><head><style>.x{color:red}</style><script>alert(1)</script></head>
    <body><h1>Điều 5 &amp; 6</h1><p>Bảo hành &quot;24 tháng&quot;.</p><ul><li>Ý một</li></ul></body></html>`;
  const out = stripMarkup(html);
  assert.ok(out.includes('Điều 5 & 6'));
  assert.ok(out.includes('Bảo hành "24 tháng".'));
  assert.ok(out.includes('Ý một'));
  assert.ok(!out.includes('alert'));
  assert.ok(!out.includes('color:red'));
});

test('stripCues: SRT bỏ số cue + timestamp, giữ lời thoại', () => {
  const srt = `1
00:00:01,000 --> 00:00:04,000
Xin chào mọi người.

2
00:00:05,000 --> 00:00:08,000
Hôm nay họp về hợp đồng.`;
  const out = stripCues(srt);
  assert.equal(out, 'Xin chào mọi người.\nHôm nay họp về hợp đồng.');
});

test('extractText route theo đuôi file; txt/md giữ nguyên', () => {
  assert.equal(extractText('a.txt', '  nội dung  '), 'nội dung');
  assert.ok(extractText('b.html', '<p>hi</p>').includes('hi'));
  assert.ok(!extractText('c.vtt', 'WEBVTT\n\n00:01.000 --> 00:02.000\nhello').includes('WEBVTT'));
});
