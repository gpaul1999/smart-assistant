import { listMeetings, getMeeting, patchMeeting, deleteMeeting, getAudio } from '../lib/db.js';
import { secToClock, fmtDate, buildMarkdown, SPEAKER_LABELS } from '../lib/format.js';

const $ = (id) => document.getElementById(id);
const STATUS_LABELS = {
  recording: 'đang ghi',
  transcribing: 'đang phiên âm',
  summarizing: 'đang tóm tắt',
  done: 'hoàn tất',
  error: 'lỗi',
};

let currentId = null;
let audioUrl = null;

init();

async function init() {
  await renderList();

  $('d-show-trans').addEventListener('change', (e) =>
    document.body.classList.toggle('hide-trans', !e.target.checked)
  );
  $('d-title').addEventListener('change', async () => {
    if (currentId) await patchMeeting(currentId, { title: $('d-title').value.trim() || 'Cuộc họp' });
    await renderList();
  });
  $('d-export-md').addEventListener('click', async () => {
    const m = await getMeeting(currentId);
    download(`${fileBase(m)}.md`, new Blob([buildMarkdown(m)], { type: 'text/markdown' }));
  });
  $('d-export-json').addEventListener('click', async () => {
    const m = await getMeeting(currentId);
    download(`${fileBase(m)}.json`, new Blob([JSON.stringify(m, null, 2)], { type: 'application/json' }));
  });
  $('d-export-audio').addEventListener('click', async () => {
    const rec = await getAudio(currentId);
    if (rec?.blob) download(`${fileBase(await getMeeting(currentId))}.webm`, rec.blob);
  });
  $('d-retranscribe').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({
      type: 'reprocess',
      meetingId: currentId,
      model: $('d-model').value,
    });
  });
  $('d-delete').addEventListener('click', async () => {
    if (!confirm('Xóa vĩnh viễn cuộc họp này (audio + transcript + tóm tắt)?')) return;
    await deleteMeeting(currentId);
    currentId = null;
    $('detail').hidden = true;
    $('placeholder').hidden = false;
    await renderList();
  });

  chrome.runtime.onMessage.addListener(async (msg) => {
    if (['pipeline-status', 'recording-stopped', 'live-segment'].includes(msg.type)) {
      await renderList();
      if (msg.meetingId === currentId) await openMeeting(currentId, { keepAudio: msg.type === 'live-segment' });
    }
  });
}

async function renderList() {
  const meetings = await listMeetings();
  const ul = $('list');
  ul.innerHTML = '';
  $('empty').hidden = meetings.length > 0;
  for (const m of meetings) {
    const li = document.createElement('li');
    li.className = m.id === currentId ? 'active' : '';
    const dur = m.durationMs ? secToClock(m.durationMs / 1000) : '';
    li.innerHTML = `
      <div class="t"></div>
      <div class="m"><span>${fmtDate(m.startedAt)}</span><span>${dur}</span>
        <span class="chip status-${m.status}">${STATUS_LABELS[m.status] || m.status || ''}</span></div>`;
    li.querySelector('.t').textContent = m.title || 'Cuộc họp';
    li.addEventListener('click', () => openMeeting(m.id));
    ul.appendChild(li);
  }
}

async function openMeeting(id, { keepAudio = false } = {}) {
  const m = await getMeeting(id);
  if (!m) return;
  currentId = id;
  $('placeholder').hidden = true;
  $('detail').hidden = false;

  $('d-title').value = m.title || 'Cuộc họp';
  $('d-date').textContent = fmtDate(m.startedAt);
  $('d-duration').textContent = m.durationMs ? secToClock(m.durationMs / 1000) : '—';
  const st = $('d-status');
  st.textContent = STATUS_LABELS[m.status] || m.status || '';
  st.className = `chip status-${m.status}`;

  if (!keepAudio) {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = null;
    const rec = await getAudio(id);
    const audio = $('d-audio');
    if (rec?.blob) {
      audioUrl = URL.createObjectURL(rec.blob);
      audio.src = audioUrl;
      audio.hidden = false;
    } else {
      audio.removeAttribute('src');
      audio.hidden = true;
    }
  }

  // summary
  const sum = m.summary || {};
  $('d-method').textContent =
    sum.method === 'gemini-nano' ? 'Gemini Nano on-device'
    : sum.method === 'extractive' ? 'extractive local' : '';
  fillList('d-keypoints', sum.keyPoints || []);
  $('d-keypoints-translated-box').hidden = !sum.keyPointsTranslated?.length;
  fillList('d-keypoints-translated', sum.keyPointsTranslated || []);
  $('d-actions-box').hidden = !sum.actionItems?.length;
  fillList('d-actions', sum.actionItems || []);

  // transcript
  const wrap = $('d-segments');
  wrap.innerHTML = '';
  for (const seg of m.segments || []) {
    const row = document.createElement('div');
    row.className = 'seg-row';
    row.innerHTML = `
      <span class="seg-time">${secToClock(seg.t0)}</span>
      <span class="seg-who">${seg.speaker ? SPEAKER_LABELS[seg.speaker] || seg.speaker : ''}</span>
      <div class="seg-body">
        <div class="seg-text"></div>
        ${seg.translation ? '<div class="seg-trans"></div>' : ''}
      </div>`;
    row.querySelector('.seg-text').textContent = seg.text;
    if (seg.translation) row.querySelector('.seg-trans').textContent = seg.translation;
    row.querySelector('.seg-time').addEventListener('click', () => {
      const audio = $('d-audio');
      if (audio.src) {
        audio.currentTime = seg.t0;
        audio.play();
      }
    });
    wrap.appendChild(row);
  }

  await renderList();
}

function fillList(id, items) {
  const ul = $(id);
  ul.innerHTML = '';
  for (const it of items) {
    const li = document.createElement('li');
    li.textContent = it;
    ul.appendChild(li);
  }
}

function fileBase(m) {
  const d = new Date(m.startedAt || Date.now());
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${date} ${(m.title || 'cuoc-hop').replace(/[\\/:*?"<>|]+/g, '')}`.slice(0, 80);
}

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
