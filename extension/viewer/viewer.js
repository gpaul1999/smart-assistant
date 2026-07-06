import { listMeetings, getMeeting, patchMeeting, deleteMeeting, getAudio } from '../lib/db.js';
import { secToClock, fmtDate, buildMarkdown, SPEAKER_LABELS } from '../lib/format.js';
import { assess, fmtBytes } from '../lib/storage-policy.js';
import { localize } from '../lib/i18n.js';
import { verifyLicense, PROD_PUBLIC_KEY } from '../lib/license.js';
import { listDocs } from '../lib/db.js';
import { buildIndex, search, chunkText } from '../lib/retrieval.js';
import { pairQA } from '../lib/question.js';
import { reviewAnswer, promptApiAvailable } from '../lib/prompter.js';

const $ = (id) => document.getElementById(id);
const STATUS_LABELS = {
  recording: 'đang ghi',
  transcribing: 'đang phiên âm',
  summarizing: 'đang tóm tắt',
  done: 'hoàn tất',
  error: 'lỗi',
  interrupted: 'gián đoạn',
};

let currentId = null;
let audioUrl = null;

init();

async function isPro() {
  const { license, licensePubKey } = await chrome.storage.local.get(['license', 'licensePubKey']);
  if (!license?.key) return false;
  return (await verifyLicense(license.key, licensePubKey || PROD_PUBLIC_KEY)).valid;
}

async function init() {
  localize(document, chrome.i18n.getMessage);
  await renderList();
  await renderQuota();
  await renderDataPanel();

  // FR-030: xóa toàn bộ dữ liệu (confirm 2 lớp)
  $('dp-delete-all').addEventListener('click', async () => {
    if (!confirm(chrome.i18n.getMessage('vwDeleteAllConfirm'))) return;
    if (!confirm('Chắc chắn? Đây là lần xác nhận cuối.')) return;
    for (const m of await listMeetings()) await deleteMeeting(m.id);
    currentId = null;
    $('detail').hidden = true;
    $('placeholder').hidden = false;
    await renderList();
    await renderQuota();
    await renderDataPanel();
  });

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
    // D3/FR-029: Whisper Small (re-transcribe chất lượng cao) là tính năng Pro
    if ($('d-model').value.includes('small') && !(await isPro())) {
      alert('Whisper Small là tính năng Pro — dán license key trong popup (mục Nâng cao). Bản free dùng Whisper Base không giới hạn.');
      return;
    }
    await chrome.runtime.sendMessage({
      type: 'reprocess',
      meetingId: currentId,
      model: $('d-model').value,
    });
  });
  $('d-review').addEventListener('click', runReview);

  $('d-delete').addEventListener('click', async () => {
    if (!confirm('Xóa vĩnh viễn cuộc họp này (audio + transcript + tóm tắt)?')) return;
    await deleteMeeting(currentId);
    currentId = null;
    $('detail').hidden = true;
    $('placeholder').hidden = false;
    await renderList();
  });

  chrome.runtime.onMessage.addListener(async (msg) => {
    // Tiến độ re-transcribe (FR-017) + tải model (FR-018) — cập nhật nhẹ, không reload
    if (msg.type === 'pipeline-status' && msg.progress != null && msg.meetingId === currentId) {
      $('d-progress').textContent = msg.progress < 100 ? `${msg.progress}%` : '';
    }
    if (msg.type === 'model-progress' && msg.progress != null) {
      $('d-progress').textContent =
        msg.progress < 100 ? `tải model ${Math.round(msg.progress)}%` : '';
    }
    if (['pipeline-status', 'recording-stopped', 'live-segment'].includes(msg.type)) {
      await renderList();
      if (msg.meetingId === currentId) await openMeeting(currentId, { keepAudio: msg.type === 'live-segment' });
      if (msg.type === 'pipeline-status' && msg.status === 'done') await renderQuota();
    }
  });
}

// spec 003 US3: rà soát hỏi–đáp so với tài liệu (Pro + Prompt API)
async function runReview() {
  if (!(await isPro())) {
    alert('Rà soát phỏng vấn là tính năng Pro — dán license key trong popup (Nâng cao).');
    return;
  }
  if (!promptApiAvailable()) {
    alert('Máy/trình duyệt chưa hỗ trợ Prompt API on-device (cần Chrome 138+). Không có dữ liệu nào được gửi đi đâu để thay thế.');
    return;
  }
  const m = await getMeeting(currentId);
  const { settings = {} } = await chrome.storage.local.get('settings');
  const docsetId = m.copilotDocsetId || settings.copilotDocsetId;
  if (!docsetId) {
    alert('Chưa có bộ tài liệu — mở "Kho tài liệu" từ popup để tạo và chọn bộ cho phiên.');
    return;
  }
  const docs = await listDocs(docsetId);
  const chunks = docs.flatMap((d) =>
    (d.chunks?.length ? d.chunks : chunkText(d.content)).map((c) => ({ ...c, docTitle: c.docTitle || d.title }))
  );
  if (!chunks.length) {
    alert('Bộ tài liệu rỗng.');
    return;
  }
  const index = buildIndex(chunks);
  const pairs = pairQA(m.segments || []);
  if (!pairs.length) {
    alert('Không tìm thấy cặp hỏi–đáp nào trong transcript.');
    return;
  }

  const st = $('d-review-status');
  $('d-review-box').hidden = false;
  const review = [];
  for (let i = 0; i < pairs.length; i++) {
    st.textContent = `${i + 1}/${pairs.length}…`;
    const p = pairs[i];
    const answerText = p.answers.map((a) => a.text).join(' ');
    const queries = [p.question.text, p.question.translation].filter(Boolean);
    const hits = search(index, queries, { k: 3 });
    const verdict = hits.length
      ? await reviewAnswer({
          question: p.question.text,
          answerText,
          excerpts: hits.map((h) => ({ text: h.chunk.text, docTitle: h.chunk.docTitle })),
          targetLang: m.targetLang || 'vi',
        })
      : null;
    review.push({
      t0: p.question.t0,
      question: p.question.text,
      answerText,
      verdict: verdict || '(không có căn cứ trong tài liệu cho câu này)',
    });
    renderReview(review);
  }
  st.textContent = 'xong';
  await patchMeeting(currentId, { review });
}

function renderReview(review) {
  const wrap = $('d-review-items');
  wrap.innerHTML = '';
  for (const r of review || []) {
    const div = document.createElement('div');
    div.className = 'review-item';
    div.innerHTML = `<div class="rq"></div><div class="ra"></div><pre class="rv"></pre>`;
    div.querySelector('.rq').textContent = `❓ [${secToClock(r.t0)}] ${r.question}`;
    div.querySelector('.ra').textContent = `🗣 ${r.answerText || '(không trả lời)'}`;
    div.querySelector('.rv').textContent = r.verdict;
    wrap.appendChild(div);
  }
}

// FR-030: panel Dữ liệu của bạn
async function renderDataPanel() {
  const meetings = await listMeetings();
  const label = chrome.i18n.getMessage('vwMeetingsCount') || 'cuộc họp';
  $('dp-count').textContent = `${meetings.length} ${label}`;
}

// FR-019: quota bar trong thư viện
async function renderQuota() {
  if (!navigator.storage?.estimate) return;
  const { usage, quota } = await navigator.storage.estimate();
  const { level, ratio, remainingHours } = assess({ usage, quota });
  if (level === 'unknown') return;
  $('quota-box').hidden = false;
  const fill = $('quota-fill');
  fill.style.width = `${Math.round(ratio * 100)}%`;
  fill.className = level === 'ok' ? '' : level;
  const hours = remainingHours == null ? '' : ` · còn ~${Math.floor(remainingHours)}h ghi âm`;
  $('quota-text').textContent = `${fmtBytes(usage)} / ${fmtBytes(quota)}${hours}`;
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
    const size = m.audioBytes ? fmtBytes(m.audioBytes) : '';
    li.innerHTML = `
      <div class="t"></div>
      <div class="m"><span>${fmtDate(m.startedAt)}</span><span>${dur}</span><span>${size}</span>
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

  // review đã lưu (spec 003)
  $('d-review-box').hidden = !m.review?.length;
  if (m.review?.length) {
    renderReview(m.review);
    $('d-review-status').textContent = '';
  }

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
