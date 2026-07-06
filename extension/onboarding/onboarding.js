// Onboarding 3 bước (spec 002 FR-021/022/027): mic + notice → ngôn ngữ → nói thử.
// Benchmark + tải model chạy nền từ bước 1 (research R1/R2); mọi thứ trong trang này,
// dùng chung lib với offscreen (model cache bằng Cache API nên tải một lần cho cả hai).
import { Transcriber, isNoiseTranscript } from '../lib/transcriber.js';
import { translateText } from '../lib/translator.js';
import { pickModels, canRealtime } from '../lib/model-policy.js';
import { localize } from '../lib/i18n.js';

const $ = (id) => document.getElementById(id);
const SR = 16000;

localize(document, chrome.i18n.getMessage);

let benchPromise = null;
let picked = { liveModel: 'Xenova/whisper-tiny', accurateModel: 'Xenova/whisper-base' };
let device = 'wasm';

const transcriber = new Transcriber({
  vendorUrl: chrome.runtime.getURL('vendor/'),
  onProgress: (p) => {
    if (p.status === 'progress' && p.progress != null) {
      $('prep-bar').value = Math.round(p.progress);
    }
  },
});

init();

async function init() {
  showStep(await currentStep());

  $('grant-mic').addEventListener('click', grantMic);
  $('lang-next').addEventListener('click', saveLang);
  $('speak').addEventListener('click', trySpeak);
  $('finish').addEventListener('click', finish);
}

async function currentStep() {
  const { onboarding = {} } = await chrome.storage.local.get('onboarding');
  return Math.min((onboarding.step || 0) + 1, 3);
}

function showStep(n) {
  for (const el of document.querySelectorAll('.step')) el.hidden = true;
  $(n === 4 ? 'step-done' : `step-${n}`).hidden = false;
  document.querySelectorAll('.dot').forEach((d, i) => {
    d.className = 'dot' + (i + 1 < n ? ' done' : i + 1 === n ? ' active' : '');
  });
  if (n >= 3) startBenchmark(); // chuẩn bị model khi tới bước 3 (hoặc sớm hơn qua grantMic)
}

async function setProgress(step, extra = {}) {
  const { onboarding = {} } = await chrome.storage.local.get('onboarding');
  await chrome.storage.local.set({
    onboarding: { ...onboarding, step: Math.max(onboarding.step || 0, step), ...extra },
  });
}

// ---- bước 1: mic + notice pháp lý (FR-027 noticeSeen)
async function grantMic() {
  const out = $('mic-result');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const t of stream.getTracks()) t.stop();
    out.className = 'ok';
    out.textContent = chrome.i18n.getMessage('onbMicOk');
    await setProgress(1, { noticeSeen: true });
    startBenchmark(); // tranh thủ tải model trong lúc user chọn ngôn ngữ
    setTimeout(() => showStep(2), 600);
  } catch (e) {
    out.className = 'err';
    out.textContent = e.message;
  }
}

// ---- bước 2: ngôn ngữ đích
async function saveLang() {
  const targetLang = $('target-lang').value || null;
  const { settings = {} } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: { ...settings, targetLang } });
  await setProgress(2);
  showStep(3);
}

// ---- benchmark + chọn model (FR-022/023, R2/R3)
function startBenchmark() {
  if (benchPromise) return benchPromise;
  benchPromise = (async () => {
    try {
      device = navigator.gpu && (await navigator.gpu.requestAdapter()) ? 'webgpu' : 'wasm';
      const silence = new Float32Array(5 * SR);
      const measure = async (model) => {
        await transcriber.transcribe(silence, { model, device }); // lần 1: tải + compile
        const t0 = performance.now();
        await transcriber.transcribe(silence, { model, device });
        return (performance.now() - t0) / 5000;
      };
      const rtfTiny = await measure('Xenova/whisper-tiny');
      // base chỉ đo khi có cửa dùng nó cho live (webgpu, hoặc tiny rất nhanh)
      let rtfBase = null;
      if (device === 'webgpu' || rtfTiny < 0.35) {
        rtfBase = await measure('Xenova/whisper-base');
      }
      picked = pickModels({ device, rtfTiny, rtfBase });
      const bench = { device, rtfTiny, rtfBase, pickedAt: Date.now() };
      const { settings = {} } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, ...picked, bench } });

      $('prep').hidden = true;
      const el = $('bench-result');
      el.hidden = false;
      el.textContent =
        chrome.i18n.getMessage('onbBenchDone') +
        `${picked.liveModel.split('/')[1]} (${device})` +
        (canRealtime({ rtfTiny }) ? '' : ' — máy chậm, phụ đề sẽ trễ hơn 2s');
      $('speak').disabled = false;
    } catch (e) {
      // Không có mạng/model → vẫn cho đi tiếp, offscreen sẽ tải khi ghi thật
      $('prep').hidden = true;
      const el = $('bench-result');
      el.hidden = false;
      el.className = 'bench err';
      el.textContent = `Chưa chuẩn bị được model (${e.message}) — sẽ tải khi bạn ghi lần đầu.`;
      $('speak').disabled = true;
    }
  })();
  return benchPromise;
}

// ---- bước 3: nói thử (R1 — aha bằng chính giọng user)
async function trySpeak() {
  const btn = $('speak');
  btn.disabled = true;
  btn.textContent = chrome.i18n.getMessage('onbListening');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new AudioContext({ sampleRate: SR });
    await ctx.audioWorklet.addModule(chrome.runtime.getURL('offscreen/pcm-capture.worklet.js'));
    const tap = new AudioWorkletNode(ctx, 'pcm-capture', { numberOfInputs: 2, numberOfOutputs: 0 });
    ctx.createMediaStreamSource(stream).connect(tap, 0, 0);
    const parts = [];
    tap.port.onmessage = (e) => parts.push(e.data.mic);
    await ctx.resume();
    await new Promise((r) => setTimeout(r, 5000));
    await ctx.close();
    for (const t of stream.getTracks()) t.stop();

    const pcm = new Float32Array(parts.reduce((n, a) => n + a.length, 0));
    let off = 0;
    for (const a of parts) { pcm.set(a, off); off += a.length; }

    const { settings = {} } = await chrome.storage.local.get('settings');
    const { text } = await transcriber.transcribe(pcm, { model: picked.liveModel, device });
    const box = $('try-result');
    box.hidden = false;
    if (isNoiseTranscript(text)) {
      $('try-text').textContent = '…(chưa nghe rõ — thử lại gần mic hơn nhé)';
      $('try-translation').textContent = '';
    } else {
      $('try-text').textContent = text;
      const tr = await translateText(text, { sourceLang: 'auto', targetLang: settings.targetLang });
      $('try-translation').textContent = tr || '';
      $('finish').textContent = chrome.i18n.getMessage('onbNext');
    }
  } catch (e) {
    $('try-result').hidden = false;
    $('try-text').textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = chrome.i18n.getMessage('onbSpeak');
  }
}

async function finish() {
  await setProgress(3, { completedAt: Date.now() });
  showStep(4);
}
