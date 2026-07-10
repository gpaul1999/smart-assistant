// Service worker: điều phối vòng đời ghi âm. Việc capture/xử lý audio thật sự
// diễn ra trong offscreen document (service worker MV3 không có getUserMedia).

import * as db from './lib/db.js';
import { recoverInterrupted } from './lib/recovery.js';
import { sourceCapabilities } from './lib/source-mode.js';
import { appendError } from './lib/diag.js';

// Ring buffer lỗi cho "Xuất chẩn đoán" (F6) — chỉ metadata, không nội dung họp
async function logError(message) {
  try {
    const { errlog = [] } = await chrome.storage.local.get('errlog');
    await chrome.storage.local.set({ errlog: appendError(errlog, message) });
  } catch {}
}

// Crash-safe recovery (FR-016): mỗi lần service worker khởi động lạnh, quét các phiên
// 'recording' mồ côi (crash/kill trước đó) → ghép audio từ chunks, đánh dấu 'interrupted'.
// Idempotent nên chạy lại không hại.
(async () => {
  try {
    const { recording } = await chrome.storage.session.get('recording');
    const recovered = await recoverInterrupted(db, {
      activeMeetingId: recording?.meetingId || null,
    });
    if (recovered.length) console.info('[recovery] khôi phục phiên gián đoạn:', recovered);
  } catch (e) {
    console.error('[recovery]', e);
  }
})();

// FR-021: cài xong → mở onboarding
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
  }
});

// (Nudge domain họp đã gỡ ở bản store đầu — quyết định F3 ops-review 2026-07-06:
// bỏ permission 'tabs' + 'notifications' cho hồ sơ review nhẹ; sẽ cân nhắc thêm lại sau.)

// FR-024: content script không nhận runtime broadcast → relay caption qua tabs.sendMessage
let recordingTabId = null;
let overlayInjected = false;

async function setupCaptions(tabId, ephemeral, sourceMode = 'tab') {
  const { settings = {} } = await chrome.storage.local.get('settings');
  const mode = settings.captionMode || 'overlay';
  if (mode === 'off') return;
  // FR-043: chế độ không-tab → không có chỗ overlay → ép cửa sổ riêng
  const canOverlay = sourceCapabilities(sourceMode).overlayCapable;
  if (mode === 'overlay' && canOverlay && tabId != null) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/overlay.js'],
      });
      overlayInjected = true;
      chrome.tabs.sendMessage(tabId, { type: 'overlay-init', ephemeral }).catch(() => {});
      return;
    } catch (e) {
      overlayInjected = false;
      chrome.runtime.sendMessage({ type: 'overlay-fallback', reason: e.message }).catch(() => {});
    }
  }
  // mode 'window' hoặc overlay thất bại → cửa sổ phụ đề riêng
  chrome.windows.create({
    url: chrome.runtime.getURL('live/live.html'),
    type: 'popup',
    width: 460,
    height: 680,
  });
}

let creatingOffscreen = null;

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen
      .createDocument({
        url: 'offscreen/offscreen.html',
        reasons: ['USER_MEDIA', 'BLOBS', 'WORKERS'],
        justification:
          'Ghi âm audio tab + microphone và chạy phiên âm/dịch/tóm tắt hoàn toàn local',
      })
      .finally(() => {
        creatingOffscreen = null;
      });
  }
  await creatingOffscreen;
}

function setBadge(text, color = '#d93025') {
  chrome.action.setBadgeText({ text });
  if (text) chrome.action.setBadgeBackgroundColor({ color });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case 'start-recording': {
          await ensureOffscreen();
          const mode = msg.mode || 'tab';
          // FR-039/040: lấy nguồn "đối phương" theo chế độ
          let streamId = null;
          if (mode === 'tab') {
            streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: msg.tabId });
          } else if (mode === 'system') {
            streamId = await new Promise((resolve, reject) => {
              chrome.desktopCapture.chooseDesktopMedia(['screen', 'window', 'audio'], (id, opts) => {
                if (!id) return reject(new Error('Bạn đã hủy chọn nguồn hệ thống'));
                if (opts && opts.canRequestAudioTrack === false) {
                  return reject(new Error('Nguồn được chọn không cho phép thu âm thanh — hãy tick "Chia sẻ âm thanh" (Windows) hoặc kiểm tra hỗ trợ của hệ điều hành'));
                }
                resolve(id);
              });
            });
          } // mode 'mic': không cần streamId
          const { settings = {} } = await chrome.storage.local.get('settings');
          // D6 (2026-07-06): Copilot live mở cho cả Free (kho giới hạn 3000 ký tự ở tầng
          // nhập liệu — lib/doc-limits.js); chỉ cần đã chọn bộ tài liệu.
          const copilot = settings.copilotDocsetId
            ? { docsetId: settings.copilotDocsetId }
            : null;
          await chrome.runtime.sendMessage({
            type: 'offscreen-start',
            streamId,
            mode,
            settings,
            ephemeral: !!msg.ephemeral,
            copilot,
            meta: { title: msg.tabTitle || 'Cuộc họp', tabId: msg.tabId },
          });
          sendResponse({ ok: true });
          break;
        }

        case 'stop-recording': {
          await chrome.runtime.sendMessage({ type: 'offscreen-stop' });
          sendResponse({ ok: true });
          break;
        }

        case 'prepare-model': {
          await ensureOffscreen();
          await chrome.runtime.sendMessage({ type: 'offscreen-prepare-model', model: msg.model });
          sendResponse({ ok: true });
          break;
        }

        case 'reprocess': {
          await ensureOffscreen();
          await chrome.runtime.sendMessage({
            type: 'offscreen-reprocess',
            meetingId: msg.meetingId,
            model: msg.model,
          });
          sendResponse({ ok: true });
          break;
        }

        // ---- thông báo trạng thái từ offscreen ----
        case 'recording-started': {
          await chrome.storage.session.set({
            recording: {
              meetingId: msg.meetingId,
              startedAt: msg.startedAt,
              title: msg.title,
              micUsed: msg.micUsed,
              ephemeral: msg.ephemeral,
              mode: msg.mode,
              tabId: msg.tabId,
            },
          });
          setBadge('REC');
          recordingTabId = msg.tabId ?? null;
          await setupCaptions(recordingTabId, msg.ephemeral, msg.mode || 'tab');
          break;
        }

        case 'live-partial':
        case 'live-segment':
        case 'answer-card': {
          if (overlayInjected && recordingTabId != null) {
            chrome.tabs.sendMessage(recordingTabId, msg).catch(() => {});
          }
          break;
        }

        case 'recording-stopped': {
          await chrome.storage.session.remove('recording');
          setBadge('…', '#f9ab00');
          if (overlayInjected && recordingTabId != null) {
            chrome.tabs.sendMessage(recordingTabId, msg).catch(() => {});
          }
          recordingTabId = null;
          overlayInjected = false;
          break;
        }

        case 'recording-error': {
          await chrome.storage.session.remove('recording');
          setBadge('ERR');
          await logError(`recording-error: ${msg.error || ''}`);
          break;
        }

        case 'pipeline-status': {
          if (msg.status === 'done') setBadge('');
          if (msg.status === 'error') {
            setBadge('ERR');
            await logError(`pipeline-error [${msg.meetingId || ''}]: ${msg.error || ''}`);
          }
          break;
        }
      }
    } catch (e) {
      console.error('[background]', e);
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true; // giữ channel cho sendResponse async
});
