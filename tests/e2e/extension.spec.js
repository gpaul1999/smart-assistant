// E2E: load extension unpacked vào Chromium thật (skill playwright-e2e),
// kiểm tra popup/viewer/permission + pipeline dữ liệu IndexedDB, chụp screenshot làm bằng chứng.
import { test, expect, chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const EXT_PATH = join(ROOT, 'extension');
const ARTIFACTS = join(ROOT, 'tests/e2e/.artifacts');
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

let context;
let extensionId;

test.beforeAll(async () => {
  mkdirSync(ARTIFACTS, { recursive: true });
  context = await chromium.launchPersistentContext('', {
    executablePath: CHROMIUM,
    headless: true, // Chrome mới: --headless (new) hỗ trợ extension
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
    ],
  });
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15000 });
  extensionId = new URL(sw.url()).host;
});

test.afterAll(async () => {
  await context?.close();
});

const extUrl = (p) => `chrome-extension://${extensionId}/${p}`;

const SAMPLE_MEETING = {
  id: 'e2e-meeting-1',
  title: 'Phỏng vấn Frontend Engineer',
  startedAt: Date.now() - 3600_000,
  endedAt: Date.now() - 3000_000,
  durationMs: 600_000,
  status: 'done',
  sourceLang: 'en',
  targetLang: 'vi',
  micUsed: true,
  segments: [
    { t0: 0, t1: 6, speaker: 'them', text: 'Can you introduce yourself?', translation: 'Bạn có thể giới thiệu về bản thân không?' },
    { t0: 6, t1: 18, speaker: 'me', text: 'I have five years of experience building React applications.', translation: 'Tôi có năm năm kinh nghiệm xây dựng ứng dụng React.' },
    { t0: 18, t1: 30, speaker: 'them', text: 'We will send you a take-home test by Friday.', translation: 'Chúng tôi sẽ gửi bạn bài test về nhà trước thứ Sáu.' },
  ],
  summary: {
    method: 'extractive',
    keyPoints: ['Candidate has five years of React experience.'],
    keyPointsTranslated: ['Ứng viên có năm năm kinh nghiệm React.'],
    actionItems: ['We will send you a take-home test by Friday.'],
  },
};

test('service worker của extension khởi động được', async () => {
  expect(extensionId).toMatch(/^[a-p]{32}$/);
});

test('popup render đúng: brand, cài đặt, cảnh báo tab không hỗ trợ', async () => {
  const page = await context.newPage();
  await page.goto(extUrl('popup/popup.html'));
  await expect(page.locator('h1')).toHaveText('Smart Meeting Assistant');
  await expect(page.locator('#target-lang')).toBeVisible();
  // popup mở trong tab chrome-extension:// → không capture được → hiện cảnh báo + disable nút
  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#toggle')).toBeDisabled();
  await expect(page.locator('#rec-status')).toBeHidden(); // không ghi âm → không hiện timer
  await page.screenshot({ path: join(ARTIFACTS, 'popup.png') });
  await page.close();
});

test('viewer: trạng thái rỗng → seed IndexedDB → hiển thị meeting + tóm tắt + transcript', async () => {
  const page = await context.newPage();
  await page.goto(extUrl('viewer/viewer.html'));
  await expect(page.locator('#empty')).toBeVisible();

  // seed dữ liệu qua chính module db.js của extension
  await page.evaluate(async (meeting) => {
    const db = await import('/lib/db.js');
    await db.putMeeting(meeting);
    await db.saveAudio(meeting.id, new Blob(['fake-audio'], { type: 'audio/webm' }), 'audio/webm');
  }, SAMPLE_MEETING);
  await page.reload();

  await expect(page.locator('#empty')).toBeHidden();
  const item = page.locator('#list li').first();
  await expect(item).toContainText('Phỏng vấn Frontend Engineer');
  await expect(item).toContainText('hoàn tất');

  await item.click();
  await expect(page.locator('#d-title')).toHaveValue('Phỏng vấn Frontend Engineer');
  await expect(page.locator('#d-keypoints li')).toHaveCount(1);
  await expect(page.locator('#d-keypoints-translated li').first()).toContainText('năm năm kinh nghiệm React');
  await expect(page.locator('#d-actions li').first()).toContainText('take-home test');
  await expect(page.locator('.seg-row')).toHaveCount(3);
  await expect(page.locator('.seg-who').nth(0)).toHaveText('Đối phương');
  await expect(page.locator('.seg-who').nth(1)).toHaveText('Bạn');
  await expect(page.locator('.seg-trans').first()).toContainText('giới thiệu về bản thân');

  await page.screenshot({ path: join(ARTIFACTS, 'viewer.png'), fullPage: true });
  await page.close();
});

test('viewer: xóa meeting quay về trạng thái rỗng', async ({}, testInfo) => {
  const page = await context.newPage();
  await page.goto(extUrl('viewer/viewer.html'));
  await page.locator('#list li').first().click();
  page.on('dialog', (d) => d.accept());
  await page.locator('#d-delete').click();
  await expect(page.locator('#empty')).toBeVisible();
  await page.close();
});

test('summarizer chạy được trong trang extension (ESM + fallback extractive)', async () => {
  const page = await context.newPage();
  await page.goto(extUrl('viewer/viewer.html'));
  const out = await page.evaluate(async () => {
    const { summarize } = await import('/lib/summarizer.js');
    return summarize(
      'Hôm nay chúng ta họp về kế hoạch ra mắt sản phẩm quý ba. ' +
        'Doanh số quý hai đạt một trăm hai mươi phần trăm chỉ tiêu nhờ kênh online. ' +
        'Đội kỹ thuật cần hoàn thành tính năng xuất dữ liệu trước ngày mười lăm. ' +
        'Anh Minh phụ trách chuẩn bị tài liệu marketing cho buổi ra mắt.',
      // env test không tải được Gemini Nano → ép fallback nhanh
      { timeoutMs: 2000 }
    );
  });
  expect(out.keyPoints.length).toBeGreaterThan(0);
  expect(out.actionItems.length).toBeGreaterThan(0);
  await page.close();
});

test('trang cấp quyền mic render đúng', async () => {
  const page = await context.newPage();
  await page.goto(extUrl('permission/permission.html'));
  await expect(page.locator('#grant')).toBeVisible();
  await page.screenshot({ path: join(ARTIFACTS, 'permission.png') });
  await page.close();
});

test('offscreen document tồn tại và load được (module import không lỗi)', async () => {
  const page = await context.newPage();
  // mở trực tiếp trang offscreen như một trang extension để bắt lỗi import/cú pháp
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(extUrl('offscreen/offscreen.html'));
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
  await page.close();
});
