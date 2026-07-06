import { getMeeting } from '../lib/db.js';
import { secToClock, SPEAKER_LABELS } from '../lib/format.js';
import { translationAvailable } from '../lib/translator.js';

const feed = document.getElementById('feed');
const meta = document.getElementById('meta');
let meetingId = null;

init();

async function init() {
  document.getElementById('show-original').addEventListener('change', (e) => {
    document.body.classList.toggle('hide-original', !e.target.checked);
  });
  document.getElementById('stop').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'stop-recording' });
  });

  const { recording } = await chrome.storage.session.get('recording');
  if (recording) {
    meetingId = recording.meetingId;
    meta.textContent = `Đang ghi: ${recording.title || ''}`;
    document.getElementById('stop').hidden = false;
    if (!recording.micUsed) {
      showNotice('Mic chưa được cấp quyền — chỉ phiên âm được phía đối phương.');
    }
    const meeting = await getMeeting(meetingId);
    for (const seg of meeting?.segments || []) renderSegment(seg);
  }
  if (!translationAvailable()) {
    showNotice('Chrome Translator API không khả dụng trên trình duyệt này — phụ đề hiển thị không kèm bản dịch. Cần Chrome 138+ để dịch on-device.');
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'answer-card' && (!meetingId || msg.meetingId === meetingId)) {
      renderCard(msg.card);
    } else if (msg.type === 'live-segment' && (!meetingId || msg.meetingId === meetingId)) {
      meetingId = msg.meetingId;
      renderSegment(msg.segment);
    } else if (msg.type === 'live-partial' && (!meetingId || msg.meetingId === meetingId)) {
      meetingId = msg.meetingId;
      renderPartial(msg.partial);
    } else if (msg.type === 'recording-started') {
      meetingId = msg.meetingId;
      meta.textContent = `Đang ghi: ${msg.title || ''}`;
      document.getElementById('stop').hidden = false;
      feed.innerHTML = '';
    } else if (msg.type === 'recording-stopped') {
      meta.textContent = 'Đã dừng — đang tóm tắt…';
      document.getElementById('stop').hidden = true;
    } else if (msg.type === 'pipeline-status' && msg.status === 'done') {
      meta.textContent = 'Hoàn tất! Mở "Thư viện cuộc họp" để xem tóm tắt.';
    } else if (msg.type === 'model-progress' && msg.progress != null) {
      document.getElementById('model-progress').textContent =
        msg.progress < 100 ? `Tải model… ${Math.round(msg.progress)}%` : '';
    }
  });
}

let interimEl = null;

function renderSegment(seg) {
  // câu chốt thay thế phụ đề tạm của cùng buffer
  if (interimEl && Number(interimEl.dataset.t0) === seg.t0) {
    interimEl.remove();
    interimEl = null;
  }
  const div = document.createElement('div');
  div.className = 'seg';
  const who = seg.speaker
    ? `<span class="who-${seg.speaker}">${SPEAKER_LABELS[seg.speaker] || seg.speaker}</span> · `
    : '';
  div.innerHTML = `
    <div class="head">${who}${secToClock(seg.t0)}</div>
    <div class="orig"></div>
    ${seg.translation ? '<div class="trans"></div>' : ''}
  `;
  div.querySelector('.orig').textContent = seg.text;
  if (seg.translation) div.querySelector('.trans').textContent = seg.translation;
  // câu chốt luôn đứng trước phụ đề tạm (nếu tạm của câu sau đã hiện)
  if (interimEl) feed.insertBefore(div, interimEl);
  else feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
}

function renderPartial(p) {
  if (!interimEl || Number(interimEl.dataset.t0) !== p.t0) {
    interimEl?.remove();
    interimEl = document.createElement('div');
    interimEl.className = 'seg interim';
    interimEl.innerHTML = `
      <div class="head"></div>
      <div class="orig"></div>
      <div class="trans"></div>`;
    feed.appendChild(interimEl);
  }
  interimEl.dataset.t0 = p.t0;
  interimEl.querySelector('.head').textContent = `${secToClock(p.t0)} · đang nghe…`;
  interimEl.querySelector('.orig').textContent = p.text;
  if (p.translation) interimEl.querySelector('.trans').textContent = p.translation;
  feed.scrollTop = feed.scrollHeight;
}

function showNotice(text) {
  const el = document.getElementById('notice');
  el.textContent = text;
  el.hidden = false;
}

// spec 003: thẻ trả lời từ tài liệu trong cửa sổ live (fallback của overlay)
let cardEl = null;
function renderCard(card) {
  if (!cardEl) {
    cardEl = document.createElement('div');
    cardEl.className = 'answer-card';
    feed.parentNode.insertBefore(cardEl, feed.nextSibling);
  }
  cardEl.innerHTML = `<div class="q"></div><div class="exs"></div><div class="sug"></div>`;
  cardEl.querySelector('.q').textContent = `❓ ${card.question}`;
  const exs = cardEl.querySelector('.exs');
  for (const ex of card.excerpts || []) {
    const d = document.createElement('div');
    d.textContent = `▸ ${ex.text} — ${ex.docTitle || ''}`;
    exs.appendChild(d);
  }
  if (card.suggestion) cardEl.querySelector('.sug').textContent = `💡 ${card.suggestion.text}`;
}
