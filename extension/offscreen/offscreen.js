// Offscreen document — nơi mọi xử lý audio diễn ra, 100% local:
//   capture tab (speaker) + mic → mix → MediaRecorder (lưu IndexedDB)
//   đồng thời tap PCM 16kHz → cắt đoạn theo khoảng lặng → Whisper (WASM) phiên âm live
//   → Chrome Translator API dịch on-device → broadcast cho cửa sổ phụ đề → lưu dần vào DB.
// Khi dừng: lưu audio, tóm tắt (Gemini Nano on-device / extractive) và hoàn tất record.

import { patchMeeting, getMeeting, saveAudio, getAudio } from '../lib/db.js';
import { Transcriber, isNoiseTranscript } from '../lib/transcriber.js';
import { summarize } from '../lib/summarizer.js';
import { translateText } from '../lib/translator.js';
import { Segmenter, rmsOf, mixdown } from '../lib/segmenter.js';
import { uid } from '../lib/format.js';

const SR = 16000;
const PARTIAL_TICK_MS = 1200; // nhịp phiên âm "tạm" — mục tiêu phụ đề hiện ≤2s sau khi nói
const VENDOR_URL = chrome.runtime.getURL('vendor/');

const DEFAULT_SETTINGS = {
  liveModel: 'Xenova/whisper-tiny',
  accurateModel: 'Xenova/whisper-base',
  sourceLang: 'auto',
  targetLang: 'vi',
  openLiveWindow: true,
};

const transcriber = new Transcriber({
  vendorUrl: VENDOR_URL,
  onProgress: (p) => {
    if (p.status === 'progress' && p.file?.endsWith('.onnx')) {
      broadcast({ type: 'model-progress', file: p.file, progress: p.progress });
    }
  },
});

let session = null; // phiên ghi âm đang chạy
let busyReprocess = false;

// Mutex inference: câu chốt (final) luôn được chạy tuần tự qua queue; phụ đề tạm (partial)
// là lossy — thấy Whisper bận thì bỏ nhịp đó, không bao giờ dồn hàng đợi gây lag lũy tiến.
let inferLock = Promise.resolve();
let inferBusy = 0;
function runExclusive(fn) {
  const prev = inferLock;
  let release;
  inferLock = new Promise((r) => (release = r));
  return (async () => {
    await prev;
    inferBusy++;
    try {
      return await fn();
    } finally {
      inferBusy--;
      release();
    }
  })();
}

function broadcast(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'offscreen-start') {
        await startRecording(msg);
        sendResponse?.({ ok: true });
      } else if (msg.type === 'offscreen-stop') {
        await stopRecording();
        sendResponse?.({ ok: true });
      } else if (msg.type === 'offscreen-reprocess') {
        reprocess(msg.meetingId, msg.model); // chạy nền, không chờ
        sendResponse?.({ ok: true });
      }
    } catch (e) {
      console.error('[offscreen]', e);
      broadcast({ type: 'recording-error', error: e.message });
      sendResponse?.({ ok: false, error: e.message });
    }
  })();
  return true;
});

// ---------------------------------------------------------------- ghi âm

async function startRecording({ streamId, settings, meta }) {
  if (session) throw new Error('Đang có phiên ghi âm khác');
  const cfg = { ...DEFAULT_SETTINGS, ...settings };

  // Audio của tab (speaker của cuộc họp)
  const tabStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId },
    },
    video: false,
  });

  // Mic — tuỳ chọn: chưa cấp quyền vẫn ghi được phía tab
  let micStream = null;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch {
    // không có quyền mic
  }

  // tabCapture làm tab bị mute → phát lại cho người dùng nghe (context sample rate gốc)
  const playCtx = new AudioContext();
  playCtx.createMediaStreamSource(tabStream).connect(playCtx.destination);
  await playCtx.resume();

  // Context 16kHz: mix để ghi file + tap PCM để phiên âm live
  const ctx = new AudioContext({ sampleRate: SR });
  await ctx.audioWorklet.addModule(chrome.runtime.getURL('offscreen/pcm-capture.worklet.js'));
  const tap = new AudioWorkletNode(ctx, 'pcm-capture', {
    numberOfInputs: 2,
    numberOfOutputs: 0,
  });
  const mixDest = ctx.createMediaStreamDestination();

  const tabSrc = ctx.createMediaStreamSource(tabStream);
  tabSrc.connect(tap, 0, 1);
  tabSrc.connect(mixDest);
  if (micStream) {
    const micSrc = ctx.createMediaStreamSource(micStream);
    micSrc.connect(tap, 0, 0);
    micSrc.connect(mixDest);
  }
  await ctx.resume();

  const recorder = new MediaRecorder(mixDest.stream, {
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 64000,
  });
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  recorder.start(5000);

  const meetingId = uid();
  const startedAt = Date.now();
  session = {
    id: meetingId,
    cfg,
    startedAt,
    tabStream,
    micStream,
    playCtx,
    ctx,
    recorder,
    chunks,
    segments: [],
    queue: Promise.resolve(),
    segmenter: null,
    stopped: false,
  };

  session.segmenter = new Segmenter({
    sr: SR,
    onSegment: (seg) => enqueueSegment(seg),
  });
  tap.port.onmessage = (e) => {
    if (session && !session.stopped) session.segmenter.push(e.data.mic, e.data.tab);
  };
  session.partialTimer = setInterval(partialTick, PARTIAL_TICK_MS);

  await patchMeeting(meetingId, {
    title: meta.title,
    startedAt,
    status: 'recording',
    segments: [],
    sourceLang: cfg.sourceLang,
    targetLang: cfg.targetLang,
    micUsed: !!micStream,
    liveModel: cfg.liveModel,
  });

  // Nạp model live ngay để phụ đề ra sớm
  transcriber.load(cfg.liveModel).catch((e) => console.error('load model', e));

  broadcast({
    type: 'recording-started',
    meetingId,
    startedAt,
    title: meta.title,
    micUsed: !!micStream,
    openLiveWindow: cfg.openLiveWindow,
  });
}

async function stopRecording() {
  if (!session) return;
  const s = session;
  s.stopped = true;
  clearInterval(s.partialTimer);

  // dừng recorder và các track
  await new Promise((resolve) => {
    s.recorder.onstop = resolve;
    s.recorder.stop();
  });
  for (const t of [...s.tabStream.getTracks(), ...(s.micStream?.getTracks() || [])]) t.stop();

  broadcast({ type: 'recording-stopped', meetingId: s.id });

  // đoạn PCM còn dư → phiên âm nốt
  s.segmenter.flush();
  await s.queue; // chờ hàng đợi phiên âm live xử lý xong

  await s.ctx.close().catch(() => {});
  await s.playCtx.close().catch(() => {});

  const endedAt = Date.now();
  const durationMs = endedAt - s.startedAt;
  const blob = new Blob(s.chunks, { type: 'audio/webm' });
  await saveAudio(s.id, blob, 'audio/webm');
  await patchMeeting(s.id, { status: 'summarizing', endedAt, durationMs });
  broadcast({ type: 'pipeline-status', meetingId: s.id, status: 'summarizing' });

  session = null;
  await finalizeSummary(s.id, s.cfg);
}

// Phụ đề tạm: phiên âm buffer đang tích lũy mỗi PARTIAL_TICK_MS, hiển thị ngay,
// sẽ được câu chốt (final, kèm dịch) thay thế khi người nói ngắt hơi.
async function partialTick() {
  const s = session;
  if (!s || s.stopped || inferBusy) return;
  const snap = s.segmenter.snapshot();
  if (!snap || !snap.hadVoice || snap.len < SR) return; // chưa đủ 1s tiếng nói
  if (snap.t1 === s.lastPartialT1) return; // không có audio mới từ nhịp trước
  s.lastPartialT1 = snap.t1;

  try {
    const mixed = mixdown(snap.mic, snap.tab);
    if (rmsOf(mixed) < 0.004) return;
    const { text } = await runExclusive(() =>
      transcriber.transcribe(mixed, { model: s.cfg.liveModel, language: s.cfg.sourceLang })
    );
    if (session !== s || s.stopped || isNoiseTranscript(text)) return;
    const partial = { t0: snap.t0, t1: snap.t1, text };
    broadcast({ type: 'live-partial', meetingId: s.id, partial });

    // dịch partial bất đồng bộ — chỉ broadcast nếu buffer này vẫn là buffer đang nói dở
    translateText(text, { sourceLang: s.cfg.sourceLang, targetLang: s.cfg.targetLang })
      .then((translation) => {
        if (translation && session === s && !s.stopped) {
          broadcast({ type: 'live-partial', meetingId: s.id, partial: { ...partial, translation } });
        }
      })
      .catch(() => {});
  } catch (e) {
    console.error('[partial]', e);
  }
}

function enqueueSegment({ mic, tab, t0, t1 }) {
  const s = session;
  if (!s) return;
  s.queue = s.queue
    .then(async () => {
      const rmsMic = rmsOf(mic);
      const rmsTab = rmsOf(tab);
      if (Math.max(rmsMic, rmsTab) < 0.004) return; // im lặng

      const mixed = mixdown(mic, tab);
      const { text } = await runExclusive(() =>
        transcriber.transcribe(mixed, { model: s.cfg.liveModel, language: s.cfg.sourceLang })
      );
      if (isNoiseTranscript(text)) return;

      let speaker = 'both';
      if (rmsMic > rmsTab * 1.4) speaker = 'me';
      else if (rmsTab > rmsMic * 1.4) speaker = 'them';

      const translation = await translateText(text, {
        sourceLang: s.cfg.sourceLang,
        targetLang: s.cfg.targetLang,
      });

      const segment = { t0, t1, speaker, text, translation };
      s.segments.push(segment);
      await patchMeeting(s.id, { segments: s.segments });
      broadcast({ type: 'live-segment', meetingId: s.id, segment });
    })
    .catch((e) => console.error('[live-segment]', e));
}

// ------------------------------------------------------------- tóm tắt

async function finalizeSummary(meetingId, cfg) {
  try {
    const meeting = await getMeeting(meetingId);
    const fullText = (meeting.segments || []).map((x) => x.text).join(' ');
    const summary = await summarize(fullText);

    // Người dùng nghe chưa thành thạo → dịch luôn các điểm chính sang targetLang
    if (cfg.targetLang && summary.keyPoints.length) {
      const translated = [];
      for (const p of summary.keyPoints) {
        const t = await translateText(p, {
          sourceLang: cfg.sourceLang,
          targetLang: cfg.targetLang,
        });
        if (t) translated.push(t);
      }
      if (translated.length) summary.keyPointsTranslated = translated;
    }

    await patchMeeting(meetingId, { status: 'done', summary });
    broadcast({ type: 'pipeline-status', meetingId, status: 'done' });
  } catch (e) {
    console.error('[summary]', e);
    await patchMeeting(meetingId, { status: 'error', errorMsg: e.message });
    broadcast({ type: 'pipeline-status', meetingId, status: 'error', error: e.message });
  }
}

// ------------------------------------------- phiên âm lại từ audio đã lưu

async function reprocess(meetingId, model) {
  if (busyReprocess) {
    broadcast({ type: 'pipeline-status', meetingId, status: 'error', error: 'Đang bận xử lý phiên khác' });
    return;
  }
  busyReprocess = true;
  try {
    const rec = await getAudio(meetingId);
    const meeting = await getMeeting(meetingId);
    if (!rec?.blob) throw new Error('Không tìm thấy audio đã lưu');

    await patchMeeting(meetingId, { status: 'transcribing' });
    broadcast({ type: 'pipeline-status', meetingId, status: 'transcribing' });

    // decode → mono 16kHz
    const decodeCtx = new AudioContext({ sampleRate: SR });
    const buf = await decodeCtx.decodeAudioData(await rec.blob.arrayBuffer());
    const mono = new Float32Array(buf.length);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < ch.length; i++) mono[i] += ch[i] / buf.numberOfChannels;
    }
    await decodeCtx.close().catch(() => {});

    const cfg = {
      sourceLang: meeting.sourceLang || 'auto',
      targetLang: meeting.targetLang || null,
    };
    const { text, chunks } = await transcriber.transcribe(mono, {
      model: model || 'Xenova/whisper-base',
      language: cfg.sourceLang,
      timestamps: true,
    });

    const oldSegments = meeting.segments || [];
    const segments = [];
    for (const ch of chunks || (text ? [{ text, timestamp: [0, null] }] : [])) {
      const t = (ch.text || '').trim();
      if (isNoiseTranscript(t)) continue;
      const t0 = ch.timestamp?.[0] ?? 0;
      const t1 = ch.timestamp?.[1] ?? t0;
      const seg = {
        t0,
        t1,
        speaker: speakerByOverlap(oldSegments, t0, t1),
        text: t,
        translation: await translateText(t, cfg),
      };
      segments.push(seg);
    }

    await patchMeeting(meetingId, { segments, accurateModel: model });
    await finalizeSummary(meetingId, cfg);
  } catch (e) {
    console.error('[reprocess]', e);
    await patchMeeting(meetingId, { status: 'error', errorMsg: e.message });
    broadcast({ type: 'pipeline-status', meetingId, status: 'error', error: e.message });
  } finally {
    busyReprocess = false;
  }
}

// Giữ nhãn người nói từ transcript live: gán theo đoạn cũ chồng lấp thời gian nhiều nhất.
function speakerByOverlap(oldSegments, t0, t1) {
  let best = null;
  let bestOverlap = 0;
  for (const o of oldSegments) {
    const ov = Math.min(t1 ?? o.t1, o.t1) - Math.max(t0, o.t0);
    if (ov > bestOverlap) {
      bestOverlap = ov;
      best = o.speaker;
    }
  }
  return best;
}
