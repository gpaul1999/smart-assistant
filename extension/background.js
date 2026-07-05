// Service worker: điều phối vòng đời ghi âm. Việc capture/xử lý audio thật sự
// diễn ra trong offscreen document (service worker MV3 không có getUserMedia).

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
            },
          });
          setBadge('REC');
          if (msg.openLiveWindow) {
            chrome.windows.create({
              url: chrome.runtime.getURL('live/live.html'),
              type: 'popup',
              width: 460,
              height: 680,
            });
          }
          break;
        }

        case 'recording-stopped': {
          await chrome.storage.session.remove('recording');
          setBadge('…', '#f9ab00');
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
