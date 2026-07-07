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
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
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

test('viewer: meeting gián đoạn (crash-recovery) hiện badge + quota bar hiển thị', async () => {
  const page = await context.newPage();
  await page.goto(extUrl('viewer/viewer.html'));
  await page.evaluate(async () => {
    const db = await import('/lib/db.js');
    await db.putMeeting({
      id: 'e2e-interrupted',
      title: 'Họp bị sập giữa chừng',
      startedAt: Date.now() - 7200_000,
      durationMs: 65_000,
      audioBytes: 512_000,
      status: 'interrupted',
      segments: [{ t0: 0, t1: 5, speaker: 'them', text: 'Nội dung trước khi sập' }],
    });
  });
  await page.reload();

  const item = page.locator('#list li', { hasText: 'Họp bị sập giữa chừng' });
  await expect(item).toContainText('gián đoạn');
  await expect(item).toContainText('500 KB'); // audioBytes hiển thị
  await expect(page.locator('#quota-box')).toBeVisible(); // FR-019
  await expect(page.locator('#quota-text')).toContainText('/');
  await page.screenshot({ path: join(ARTIFACTS, 'viewer-interrupted.png') });
  await page.close();
});

test('deleteMeeting dọn cả 3 store (meetings, audio, audio_chunks)', async () => {
  const page = await context.newPage();
  await page.goto(extUrl('viewer/viewer.html'));
  const leftovers = await page.evaluate(async () => {
    const db = await import('/lib/db.js');
    await db.putMeeting({ id: 'e2e-del', title: 'Sắp xóa', startedAt: 1, status: 'done' });
    await db.saveAudio('e2e-del', new Blob(['x']), 'audio/webm');
    await db.putAudioChunk('e2e-del', 0, new Blob(['chunk']));
    await db.deleteMeeting('e2e-del');
    return {
      meeting: await db.getMeeting('e2e-del'),
      audio: await db.getAudio('e2e-del'),
      chunks: (await db.getAudioChunks('e2e-del')).length,
    };
  });
  expect(leftovers.meeting).toBeFalsy();
  expect(leftovers.audio).toBeFalsy();
  expect(leftovers.chunks).toBe(0);
  await page.close();
});

test('recovery: meeting recording mồ côi + chunks → interrupted với audio ghép', async () => {
  const page = await context.newPage();
  await page.goto(extUrl('viewer/viewer.html'));
  const out = await page.evaluate(async () => {
    const db = await import('/lib/db.js');
    const { recoverInterrupted } = await import('/lib/recovery.js');
    await db.putMeeting({
      id: 'e2e-crash',
      title: 'Đang ghi thì sập',
      startedAt: Date.now(),
      status: 'recording',
      segments: [{ t0: 0, t1: 8, speaker: 'me', text: 'câu đã chốt' }],
    });
    await db.putAudioChunk('e2e-crash', 0, new Blob(['head']));
    await db.putAudioChunk('e2e-crash', 1, new Blob(['tail']));
    const recovered = await recoverInterrupted(db);
    const m = await db.getMeeting('e2e-crash');
    const audio = await db.getAudio('e2e-crash');
    const result = {
      recovered,
      status: m.status,
      durationMs: m.durationMs,
      audioText: audio ? await audio.blob.text() : null,
      chunksLeft: (await db.getAudioChunks('e2e-crash')).length,
    };
    await db.deleteMeeting('e2e-crash');
    return result;
  });
  expect(out.recovered).toContain('e2e-crash');
  expect(out.status).toBe('interrupted');
  expect(out.durationMs).toBe(10_000); // 2 chunk × 5s > câu chốt cuối 8s
  expect(out.audioText).toBe('headtail');
  expect(out.chunksLeft).toBe(0);
  await page.close();
});

test('popup: có nút chuẩn bị model + dòng lưu trữ (FR-018/FR-019)', async () => {
  const page = await context.newPage();
  await page.goto(extUrl('popup/popup.html'));
  await expect(page.locator('#quota')).not.toHaveText('…');
  await page.locator('details summary').click();
  await expect(page.locator('#prepare-model')).toBeVisible();
  await page.screenshot({ path: join(ARTIFACTS, 'popup-advanced.png') });
  await page.close();
});

test('webm-opus demuxer chạy được trong trang extension (ESM)', async () => {
  const page = await context.newPage();
  await page.goto(extUrl('viewer/viewer.html'));
  const ok = await page.evaluate(async () => {
    const { demuxWebmOpus } = await import('/lib/webm-opus.js');
    const out = demuxWebmOpus(new Uint8Array([0, 1, 2]));
    return Array.isArray(out.packets);
  });
  expect(ok).toBe(true);
  await page.close();
});

test('onboarding: 3 bước, cấp mic (fake) chuyển bước, skip → done + state lưu', async () => {
  const page = await context.newPage();
  await page.goto(extUrl('onboarding/onboarding.html'));
  await expect(page.locator('#step-1')).toBeVisible();
  await expect(page.locator('h1')).not.toHaveText('');

  await page.locator('#grant-mic').click();
  await expect(page.locator('#mic-result')).toHaveClass(/ok/);
  await expect(page.locator('#step-2')).toBeVisible({ timeout: 3000 });

  await page.locator('#target-lang').selectOption('vi');
  await page.locator('#lang-next').click();
  await expect(page.locator('#step-3')).toBeVisible();

  await page.locator('#finish').click();
  await expect(page.locator('#step-done')).toBeVisible();

  const state = await page.evaluate(() => chrome.storage.local.get(['onboarding', 'settings']));
  expect(state.onboarding.step).toBe(3);
  expect(state.onboarding.noticeSeen).toBe(true);
  expect(state.settings.targetLang).toBe('vi');
  await page.screenshot({ path: join(ARTIFACTS, 'onboarding.png') });
  await page.close();
});

test('overlay: inject + render partial/final + đổi cỡ chữ', async () => {
  const page = await context.newPage();
  await page.goto(extUrl('viewer/viewer.html'));
  await page.addScriptTag({ url: '/content/overlay.js' }); // same-origin → qua CSP 'self'
  await page.waitForFunction(() => !!window.__smaOverlay);

  await page.evaluate(() => {
    window.__smaOverlay.renderPartial({ t0: 0, t1: 2, text: 'this is interim', translation: '' });
    window.__smaOverlay.renderSegment({
      t0: 0, t1: 3, speaker: 'them',
      text: 'Can you introduce yourself?',
      translation: 'Bạn giới thiệu bản thân nhé?',
    });
  });
  const shadowText = await page.evaluate(
    () => window.__smaOverlay.host.shadowRoot.querySelector('.lines').textContent
  );
  expect(shadowText).toContain('Can you introduce yourself?');
  expect(shadowText).toContain('Bạn giới thiệu bản thân nhé?');
  expect(shadowText).not.toContain('this is interim'); // final thay interim

  const fsBefore = await page.evaluate(() =>
    window.__smaOverlay.host.shadowRoot.querySelector('.box').style.getPropertyValue('--fs')
  );
  await page.evaluate(() => window.__smaOverlay.host.shadowRoot.querySelector('.plus').click());
  const fsAfter = await page.evaluate(() =>
    window.__smaOverlay.host.shadowRoot.querySelector('.box').style.getPropertyValue('--fs')
  );
  expect(parseInt(fsAfter)).toBeGreaterThan(parseInt(fsBefore || '17'));
  await page.screenshot({ path: join(ARTIFACTS, 'overlay.png') });
  await page.close();
});

test('popup: caption-mode select + license input + ephemeral checkbox (002)', async () => {
  const page = await context.newPage();
  await page.goto(extUrl('popup/popup.html'));
  await expect(page.locator('#caption-mode option')).toHaveCount(3);
  await expect(page.locator('#ephemeral')).toBeAttached();
  await page.locator('details summary').click();
  await expect(page.locator('#license-key')).toBeVisible();
  // key rác → không có trạng thái Pro
  await page.locator('#license-key').fill('SMA1.xxx.yyy');
  await page.locator('#license-key').dispatchEvent('change');
  await expect(page.locator('#license-status')).not.toHaveClass(/ok/);
  await page.close();
});

test('viewer: panel Dữ liệu của bạn + xóa toàn bộ', async () => {
  const page = await context.newPage();
  await page.goto(extUrl('viewer/viewer.html'));
  await page.evaluate(async () => {
    const db = await import('/lib/db.js');
    for (const m of await db.listMeetings()) await db.deleteMeeting(m.id); // dọn test trước
    await db.putMeeting({ id: 'dp-1', title: 'A', startedAt: 1, status: 'done' });
    await db.putMeeting({ id: 'dp-2', title: 'B', startedAt: 2, status: 'done' });
  });
  await page.reload();
  await expect(page.locator('#dp-count')).toContainText('2');
  page.on('dialog', (d) => d.accept());
  await page.locator('#dp-delete-all').click();
  await expect(page.locator('#dp-count')).toContainText('0');
  await expect(page.locator('#empty')).toBeVisible();
  await page.close();
});

test('docs page: tạo docset, thêm tài liệu (chunk sẵn), xóa docset', async () => {
  const page = await context.newPage();
  await page.goto(extUrl('docs/docs.html'));
  await expect(page.locator('#pro-banner')).toBeVisible(); // chưa Pro → banner

  await page.locator('#new-docset').fill('Khách ACME');
  await page.locator('#add-docset').click();
  await expect(page.locator('#docsets li')).toContainText('Khách ACME');
  await expect(page.locator('#doc-pane')).toBeVisible();

  await page.locator('#doc-title').fill('Hợp đồng 2026');
  await page.locator('#doc-content').fill(
    'Điều 5. Bảo hành: 24 tháng kể từ ngày nghiệm thu. '.repeat(60)
  );
  await page.locator('#add-doc').click();
  const docLi = page.locator('#docs li').first();
  await expect(docLi).toContainText('Hợp đồng 2026');
  await expect(docLi).toContainText('đoạn'); // chunk đã tính sẵn

  await page.screenshot({ path: join(ARTIFACTS, 'docs.png') });
  page.on('dialog', (d) => d.accept());
  await page.locator('#delete-docset').click();
  await expect(page.locator('#docsets li')).toHaveCount(0);
  await page.close();
});

test('overlay: answer-card render trích đoạn + câu đề xuất grounded', async () => {
  const page = await context.newPage();
  await page.goto(extUrl('viewer/viewer.html'));
  await page.addScriptTag({ url: '/content/overlay.js' });
  await page.waitForFunction(() => !!window.__smaOverlay);
  await page.evaluate(() => {
    window.__smaOverlay.renderCard({
      qT0: 12,
      question: 'Điều khoản bảo hành là gì?',
      excerpts: [{ text: 'Bảo hành 24 tháng kể từ nghiệm thu.', docTitle: 'Hợp đồng ACME' }],
      suggestion: { text: 'Sản phẩm được bảo hành 24 tháng kể từ ngày nghiệm thu [1].', citations: [1] },
    });
  });
  const txt = await page.evaluate(
    () => window.__smaOverlay.host.shadowRoot.querySelector('.cardbox').textContent
  );
  expect(txt).toContain('bảo hành là gì');
  expect(txt).toContain('Hợp đồng ACME');
  expect(txt).toContain('bảo hành 24 tháng kể từ ngày nghiệm thu [1]');
  await page.screenshot({ path: join(ARTIFACTS, 'answer-card.png') });
  await page.close();
});

test('popup: có select Copilot tài liệu + viewer có nút rà soát (gate Pro)', async () => {
  const page = await context.newPage();
  await page.goto(extUrl('popup/popup.html'));
  await page.locator('details summary').click();
  await expect(page.locator('#copilot-docset')).toBeVisible();

  await page.goto(extUrl('viewer/viewer.html'));
  await page.evaluate(async () => {
    const db = await import('/lib/db.js');
    await db.putMeeting({ id: 'rv-1', title: 'PV', startedAt: 1, status: 'done', segments: [] });
  });
  await page.reload();
  await page.locator('#list li', { hasText: 'PV' }).click();
  page.on('dialog', (d) => d.accept());
  await page.locator('#d-review').click(); // chưa Pro → alert gate, không crash
  await expect(page.locator('#d-review-box')).toBeHidden();
  await page.evaluate(async () => {
    const db = await import('/lib/db.js');
    await db.deleteMeeting('rv-1');
  });
  await page.close();
});

test('nguồn âm (004): 3 chế độ; Chỉ mic bật được nút ghi dù không có tab hợp lệ', async () => {
  const page = await context.newPage();
  await page.goto(extUrl('popup/popup.html'));
  await expect(page.locator('#source-mode option')).toHaveCount(3);

  // popup đang mở trong tab chrome-extension:// → chế độ Tab bị chặn
  await expect(page.locator('#toggle')).toBeDisabled();

  // chuyển sang Chỉ mic → không cần tab → nút ghi bật (SC-021, FR-039)
  await page.locator('#source-mode').selectOption('mic');
  await expect(page.locator('#toggle')).toBeEnabled();
  await expect(page.locator('#tab-title')).toContainText('không cần tab');

  // setting được nhớ
  await page.reload();
  await expect(page.locator('#source-mode')).toHaveValue('mic');
  await page.locator('#source-mode').selectOption('tab'); // trả về mặc định cho test khác
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
