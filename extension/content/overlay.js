// Overlay phụ đề trong tab họp (spec 002 FR-024) — inject qua chrome.scripting khi bắt
// đầu ghi (activeTab). Shadow DOM kín để không đụng CSS trang; kéo-thả, chỉnh cỡ chữ,
// vị trí nhớ theo origin. Nhận caption do background relay qua tabs.sendMessage.
// Classic script (không module) vì executeScript files yêu cầu vậy.
(() => {
  if (window.__smaOverlay) {
    window.__smaOverlay.show();
    return;
  }

  const origin = location.origin;
  const host = document.createElement('div');
  host.style.cssText =
    'all:initial; position:fixed; z-index:2147483647; left:0; top:0; width:0; height:0;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      .box {
        position: fixed; left: 50%; bottom: 48px; transform: translateX(-50%);
        min-width: 320px; max-width: 720px;
        background: rgba(12, 15, 19, 0.88); color: #e8eaed;
        border-radius: 14px; padding: 10px 14px 12px;
        font: 500 var(--fs, 17px)/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
        box-shadow: 0 6px 28px rgba(0,0,0,.45);
      }
      .bar { display: flex; align-items: center; gap: 8px; cursor: grab; user-select: none;
             font-size: 11px; opacity: .75; padding-bottom: 6px; }
      .bar:active { cursor: grabbing; }
      .bar .title { flex: 1; }
      .bar button {
        all: unset; cursor: pointer; padding: 1px 7px; border-radius: 6px;
        background: rgba(255,255,255,.12); font-size: 11px;
      }
      .bar button:hover { background: rgba(255,255,255,.25); }
      .bar .stop { background: #dc2626; color: #fff; font-weight: 700; }
      .line { margin: 2px 0; }
      .who { font-size: 11px; opacity: .6; margin-right: 6px; }
      .orig { opacity: .85; }
      .trans { color: #9be8a8; font-weight: 600; }
      .interim { opacity: .55; font-style: italic; }
      .tag { color: #ffd479; }
      .card {
        margin-top: 8px; padding: 8px 10px; border-radius: 10px;
        background: rgba(37, 99, 235, .18); border: 1px solid rgba(37, 99, 235, .45);
        font-size: calc(var(--fs, 17px) * .82);
      }
      .card .q { opacity: .75; font-size: 11px; margin-bottom: 4px; }
      .card .ex { margin: 3px 0; opacity: .9; }
      .card .src { opacity: .55; font-size: 10px; }
      .card .sug { margin-top: 6px; color: #9be8a8; font-weight: 600; }
      .card .hide { all: unset; cursor: pointer; float: right; opacity: .6; }
    </style>
    <div class="box" part="box">
      <div class="bar">
        <span class="title">🎙️ Smart Meeting Assistant <span class="tag"></span></span>
        <button class="minus">A−</button>
        <button class="plus">A+</button>
        <button class="stop"></button>
        <button class="close">✕</button>
      </div>
      <div class="lines"></div>
      <div class="cardbox"></div>
    </div>`;
  document.documentElement.appendChild(host);

  const box = shadow.querySelector('.box');
  const lines = shadow.querySelector('.lines');
  const msgOf = (k, fb) => (chrome.i18n?.getMessage(k) || fb);
  shadow.querySelector('.stop').textContent = msgOf('ovlStop', 'Dừng');

  // ---- prefs theo origin
  let prefs = { x: null, y: null, fontPx: 17 };
  chrome.storage.local.get('overlayPrefs').then(({ overlayPrefs = {} }) => {
    prefs = { ...prefs, ...(overlayPrefs[origin] || {}) };
    applyPrefs();
  });
  function applyPrefs() {
    box.style.setProperty('--fs', `${prefs.fontPx}px`);
    if (prefs.x != null && prefs.y != null) {
      box.style.left = `${prefs.x}px`;
      box.style.top = `${prefs.y}px`;
      box.style.bottom = 'auto';
      box.style.transform = 'none';
    }
  }
  async function savePrefs() {
    const { overlayPrefs = {} } = await chrome.storage.local.get('overlayPrefs');
    overlayPrefs[origin] = prefs;
    await chrome.storage.local.set({ overlayPrefs });
  }

  // ---- kéo-thả
  const bar = shadow.querySelector('.bar');
  let drag = null;
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    const r = box.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener('pointermove', (e) => {
    if (!drag) return;
    prefs.x = Math.max(0, e.clientX - drag.dx);
    prefs.y = Math.max(0, e.clientY - drag.dy);
    applyPrefs();
  });
  bar.addEventListener('pointerup', () => {
    if (drag) savePrefs();
    drag = null;
  });

  shadow.querySelector('.minus').addEventListener('click', () => {
    prefs.fontPx = Math.max(12, prefs.fontPx - 2);
    applyPrefs();
    savePrefs();
  });
  shadow.querySelector('.plus').addEventListener('click', () => {
    prefs.fontPx = Math.min(34, prefs.fontPx + 2);
    applyPrefs();
    savePrefs();
  });
  shadow.querySelector('.close').addEventListener('click', () => host.remove());
  shadow.querySelector('.stop').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'stop-recording' }).catch(() => {});
  });

  // ---- render caption: giữ 2 câu chốt gần nhất + 1 dòng interim
  const SPEAKERS = { me: 'Bạn', them: 'Đối phương', both: 'Cả hai' };
  const finals = [];
  let interimEl = null;

  function lineEl(seg, interim) {
    const div = document.createElement('div');
    div.className = 'line' + (interim ? ' interim' : '');
    const who = seg.speaker ? `<span class="who">${SPEAKERS[seg.speaker] || ''}</span>` : '';
    div.innerHTML = `${who}<span class="orig"></span> <span class="trans"></span>`;
    div.querySelector('.orig').textContent = seg.text;
    div.querySelector('.trans').textContent = seg.translation || '';
    return div;
  }

  function renderPartial(p) {
    const el = lineEl(p, true);
    if (interimEl) interimEl.replaceWith(el);
    else lines.appendChild(el);
    interimEl = el;
  }

  function renderSegment(seg) {
    if (interimEl) {
      interimEl.remove();
      interimEl = null;
    }
    finals.push(lineEl(seg, false));
    while (finals.length > 2) finals.shift().remove();
    lines.appendChild(finals[finals.length - 1]);
  }

  // spec 003: thẻ trả lời từ tài liệu — trích đoạn tức thời, câu đề xuất grounded theo sau
  const cardbox = shadow.querySelector('.cardbox');
  function renderCard(card) {
    cardbox.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'card';
    const hide = document.createElement('button');
    hide.className = 'hide';
    hide.textContent = '✕';
    hide.addEventListener('click', () => cardbox.replaceChildren());
    div.appendChild(hide);
    const q = document.createElement('div');
    q.className = 'q';
    q.textContent = `❓ ${card.question}`;
    div.appendChild(q);
    for (const ex of card.excerpts || []) {
      const e = document.createElement('div');
      e.className = 'ex';
      e.textContent = `▸ ${ex.text}`;
      const src = document.createElement('span');
      src.className = 'src';
      src.textContent = `  — ${ex.docTitle || ''}`;
      e.appendChild(src);
      div.appendChild(e);
    }
    if (card.suggestion) {
      const sg = document.createElement('div');
      sg.className = 'sug';
      sg.textContent = `💡 ${card.suggestion.text}`;
      div.appendChild(sg);
    }
    cardbox.appendChild(div);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'live-partial') renderPartial(msg.partial);
    else if (msg.type === 'live-segment') renderSegment(msg.segment);
    else if (msg.type === 'answer-card') renderCard(msg.card);
    else if (msg.type === 'recording-stopped') setTimeout(() => host.remove(), 4000);
    else if (msg.type === 'overlay-init' && msg.ephemeral) {
      shadow.querySelector('.tag').textContent = `(${msgOf('ovlEphemeralTag', 'phiên không lưu')})`;
    }
  });

  // Hook cho E2E + API tối thiểu
  window.__smaOverlay = {
    show: () => document.documentElement.appendChild(host),
    renderPartial,
    renderSegment,
    renderCard,
    host,
  };
})();
