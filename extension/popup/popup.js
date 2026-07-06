import { assess, fmtBytes } from '../lib/storage-policy.js';

const $ = (id) => document.getElementById(id);

const DEFAULT_SETTINGS = {
  liveModel: 'Xenova/whisper-tiny',
  accurateModel: 'Xenova/whisper-base',
  sourceLang: 'auto',
  targetLang: 'vi',
  openLiveWindow: true,
};

let currentTab = null;
let timerId = null;
let quotaCritical = false;

init();

async function init() {
  await loadSettings();
  await refreshQuota();
  await refreshTab();
  await refreshMicStatus();
  await refreshRecordingState();

  $('prepare-model').addEventListener('click', async () => {
    $('model-progress').textContent = 'đang chuẩn bị…';
    await chrome.runtime.sendMessage({ type: 'prepare-model', model: $('live-model').value });
  });

  // Chống trình duyệt tự dọn IndexedDB khi thiếu chỗ (FR-019) — xin một lần
  const { persistAsked } = await chrome.storage.local.get('persistAsked');
  if (!persistAsked && navigator.storage?.persist) {
    navigator.storage.persist().catch(() => {});
    await chrome.storage.local.set({ persistAsked: true });
  }

  $('toggle').addEventListener('click', onToggle);
  $('open-viewer').addEventListener('click', () =>
    chrome.tabs.create({ url: chrome.runtime.getURL('viewer/viewer.html') })
  );
  $('open-live-window').addEventListener('click', () =>
    chrome.windows.create({
      url: chrome.runtime.getURL('live/live.html'),
      type: 'popup', width: 460, height: 680,
    })
  );
  $('mic-grant').addEventListener('click', () =>
    chrome.tabs.create({ url: chrome.runtime.getURL('permission/permission.html') })
  );
  for (const id of ['target-lang', 'source-lang', 'live-model', 'open-live']) {
    $(id).addEventListener('change', saveSettings);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (['recording-started', 'recording-stopped', 'pipeline-status', 'recording-error'].includes(msg.type)) {
      refreshRecordingState();
    }
    if (msg.type === 'model-progress' && msg.progress != null) {
      $('model-progress').textContent =
        msg.progress >= 100 ? '✔ sẵn sàng' : `${Math.round(msg.progress)}%`;
    }
  });
}

// FR-019: hiển thị mức dùng lưu trữ; critical → chặn phiên ghi mới
async function refreshQuota() {
  const el = $('quota');
  if (!navigator.storage?.estimate) {
    el.textContent = 'không kiểm tra được';
    return;
  }
  const { usage, quota } = await navigator.storage.estimate();
  const { level, remainingHours } = assess({ usage, quota });
  quotaCritical = level === 'critical';
  const hours = remainingHours == null ? '' : ` · còn ~${Math.floor(remainingHours)}h ghi âm`;
  el.textContent = `${fmtBytes(usage)} / ${fmtBytes(quota)}${hours}`;
  el.className = `value ${level === 'critical' ? 'warn' : level === 'warn' ? 'warn' : ''}`;
  if (quotaCritical) {
    showError('Bộ nhớ trình duyệt sắp đầy — hãy mở Thư viện để xóa/xuất bớt cuộc họp cũ trước khi ghi mới.');
  }
}

async function loadSettings() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  const s = { ...DEFAULT_SETTINGS, ...settings };
  $('target-lang').value = s.targetLang ?? '';
  $('source-lang').value = s.sourceLang;
  $('live-model').value = s.liveModel;
  $('open-live').checked = s.openLiveWindow;
}

async function saveSettings() {
  const settings = {
    ...DEFAULT_SETTINGS,
    targetLang: $('target-lang').value || null,
    sourceLang: $('source-lang').value,
    liveModel: $('live-model').value,
    openLiveWindow: $('open-live').checked,
  };
  await chrome.storage.local.set({ settings });
}

async function refreshTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  const capturable = tab?.url && /^https?:/.test(tab.url);
  $('tab-title').textContent = tab?.title || '(không xác định)';
  if (!capturable) {
    showError('Tab này không ghi âm được — hãy mở tab cuộc họp (Google Meet, Zoom web…) rồi bấm lại icon extension.');
    $('toggle').disabled = true;
  } else {
    $('toggle').disabled = quotaCritical; // FR-019: hết chỗ → không cho ghi mới
  }
}

async function refreshMicStatus() {
  try {
    const st = await navigator.permissions.query({ name: 'microphone' });
    const el = $('mic-status');
    if (st.state === 'granted') {
      el.textContent = 'Đã cấp quyền';
      el.className = 'value ok';
      $('mic-grant').hidden = true;
    } else {
      el.textContent = 'Chưa cấp quyền (chỉ ghi được phía đối phương)';
      el.className = 'value warn';
      $('mic-grant').hidden = false;
    }
    st.onchange = refreshMicStatus;
  } catch {
    $('mic-status').textContent = 'Không kiểm tra được';
  }
}

async function refreshRecordingState() {
  const { recording } = await chrome.storage.session.get('recording');
  const btn = $('toggle');
  if (recording) {
    btn.textContent = 'Dừng ghi';
    btn.classList.add('recording');
    btn.disabled = false;
    $('rec-status').hidden = false;
    $('rec-title').textContent = recording.title || '';
    $('open-live-window').hidden = false;
    if (!timerId) {
      const tick = () => {
        const sec = Math.floor((Date.now() - recording.startedAt) / 1000);
        $('rec-elapsed').textContent =
          `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
      };
      tick();
      timerId = setInterval(tick, 1000);
    }
  } else {
    btn.textContent = 'Bắt đầu ghi';
    btn.classList.remove('recording');
    $('rec-status').hidden = true;
    $('open-live-window').hidden = true;
    if (timerId) { clearInterval(timerId); timerId = null; }
    await refreshTab();
  }
}

async function onToggle() {
  hideError();
  const { recording } = await chrome.storage.session.get('recording');
  const btn = $('toggle');
  btn.disabled = true;
  try {
    if (recording) {
      await chrome.runtime.sendMessage({ type: 'stop-recording' });
    } else {
      await saveSettings();
      const resp = await chrome.runtime.sendMessage({
        type: 'start-recording',
        tabId: currentTab.id,
        tabTitle: currentTab.title,
      });
      if (resp && !resp.ok) throw new Error(resp.error || 'Không bắt đầu được');
    }
  } catch (e) {
    showError(e.message);
  } finally {
    btn.disabled = false;
    refreshRecordingState();
  }
}

function showError(text) {
  const el = $('error');
  el.textContent = text;
  el.hidden = false;
}
function hideError() {
  $('error').hidden = true;
}
