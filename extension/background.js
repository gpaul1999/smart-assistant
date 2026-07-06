// Service worker: điều phối vòng đời ghi âm. Việc capture/xử lý audio thật sự
// diễn ra trong offscreen document (service worker MV3 không có getUserMedia).

import * as db from './lib/db.js';
import { recoverInterrupted } from './lib/recovery.js';

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

// FR-028: nhắc ghi khi vào domain họp (badge + notification 1 lần/tab, KHÔNG tự ghi)
const MEETING_HOSTS = /(^|\.)meet\.google\.com$|(^|\.)zoom\.us$|(^|\.)teams\.microsoft\.com$|(^|\.)teams\.live\.com$/;
const nudgedTabs = new Set();
chrome.tabs.onRemoved.addListener((tabId) => nudgedTabs.delete(tabId));
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  let host = '';
  try { host = new URL(tab.url).hostname; } catch { return; }
  if (!MEETING_HOSTS.test(host)) return;
  chrome.action.setBadgeText({ tabId, text: '●' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#2563eb' });
  const { settings = {} } = await chrome.storage.local.get('settings');
  if (settings.meetingNudge === false || nudgedTabs.has(tabId)) return;
  const { recording } = await chrome.storage.session.get('recording');
  if (recording) return; // FR-005: đang ghi phiên khác thì không nhắc
  nudgedTabs.add(tabId);
  chrome.notifications?.create(`nudge-${tabId}`, {
    type: 'basic',
    iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    title: 'Smart Meeting Assistant',
    message: 'Bạn đang ở tab cuộc họp — bấm icon extension để ghi + phụ đề dịch trực tiếp.',
  });
});
chrome.notifications?.onClicked.addListener((id) => {
  if (!id.startsWith('nudge-')) return;
  const tabId = Number(id.slice(6));
  chrome.tabs.update(tabId, { active: true });
  chrome.action.openPopup?.().catch(() => {}); // best-effort (R6)
  chrome.notifications.clear(id);
});

// FR-024: content script không nhận runtime broadcast → relay caption qua tabs.sendMessage
let recordingTabId = null;
let overlayInjected = false;

async function setupCaptions(tabId, ephemeral) {
  const { settings = {} } = await chrome.storage.local.get('settings');
  const mode = settings.captionMode || 'overlay';
  if (mode === 'off') return;
  if (mode === 'overlay' && tabId != null) {
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
          const streamId = await chrome.tabCapture.getMediaStreamId({
            targetTabId: msg.tabId,
          });
          const { settings = {} } = await chrome.storage.local.get('settings');
          await chrome.runtime.sendMessage({
            type: 'offscreen-start',
            streamId,
            settings,
            ephemeral: !!msg.ephemeral,
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
              tabId: msg.tabId,
            },
          });
          setBadge('REC');
          recordingTabId = msg.tabId ?? null;
          await setupCaptions(recordingTabId, msg.ephemeral);
          break;
        }

        case 'live-partial':
        case 'live-segment': {
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
          break;
        }

        case 'pipeline-status': {
          if (msg.status === 'done') setBadge('');
          if (msg.status === 'error') setBadge('ERR');
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
