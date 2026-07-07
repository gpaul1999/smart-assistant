// Offscreen document — nơi mọi xử lý audio diễn ra, 100% local:
//   capture tab (speaker) + mic → mix → MediaRecorder (lưu IndexedDB)
//   đồng thời tap PCM 16kHz → cắt đoạn theo khoảng lặng → Whisper (WASM) phiên âm live
//   → Chrome Translator API dịch on-device → broadcast cho cửa sổ phụ đề → lưu dần vào DB.
// Khi dừng: lưu audio, tóm tắt (Gemini Nano on-device / extractive) và hoàn tất record.

import {
  patchMeeting,
  getMeeting,
  saveAudio,
  getAudio,
  putAudioChunk,
  getAudioChunks,
  deleteAudioChunks,
} from '../lib/db.js';
import { Transcriber, isNoiseTranscript } from '../lib/transcriber.js';
import { summarize } from '../lib/summarizer.js';
import { translateText } from '../lib/translator.js';
import { Segmenter, rmsOf, mixdown, labelSpeaker } from '../lib/segmenter.js';
import { demuxWebmOpus } from '../lib/webm-opus.js';
import { uid } from '../lib/format.js';
import { listDocs } from '../lib/db.js';
import { buildIndex, search, chunkText } from '../lib/retrieval.js';
import { isQuestion } from '../lib/question.js';
import { synthesizeAnswer } from '../lib/prompter.js';
import { sourceCapabilities, micConstraints } from '../lib/source-mode.js';

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

// Thiết bị inference từ benchmark (spec 002 FR-022/023); thiếu → wasm
function deviceOf(cfg) {
  return cfg?.bench?.device || 'wasm';
}

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
      } else if (msg.type === 'offscreen-prepare-model') {
        // Tải model trước khi vào họp (FR-018) — tiến độ broadcast qua model-progress
        chrome.storage.local.get('settings').then(({ settings = {} }) =>
          transcriber.load(msg.model, { device: deviceOf(settings) })
        )
          .then(() => broadcast({ type: 'model-progress', file: 'ready', progress: 100 }))
          .catch((e) => console.error('[prepare-model]', e));
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

async function startRecording({ streamId, settings, meta, ephemeral = false, copilot = null, mode = 'tab' }) {
  if (session) throw new Error('Đang có phiên ghi âm khác');
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  const caps = sourceCapabilities(mode);

  // spec 003: nạp kho tài liệu Copilot (đã gate Pro ở background — FR-037)
  let copilotIndex = null;
  if (copilot?.docsetId) {
    try {
      const docs = await listDocs(copilot.docsetId);
      const chunks = docs.flatMap((d) =>
        (d.chunks?.length ? d.chunks : chunkText(d.content)).map((c) => ({
          ...c,
          docTitle: c.docTitle || d.title,
        }))
      );
      if (chunks.length) copilotIndex = buildIndex(chunks);
    } catch (e) {
      console.error('[copilot] load docset', e);
    }
  }

  // Nguồn "đối phương" theo chế độ (spec 004 FR-039/040): tab / hệ thống / không có (mic-only)
  let themStream = null;
  if (mode === 'tab') {
    themStream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
      video: false,
    });
  } else if (mode === 'system') {
    // desktopCapture bắt buộc xin kèm video — lấy xong dừng ngay video track
    const desktop = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: streamId } },
      video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: streamId } },
    });
    for (const t of desktop.getVideoTracks()) t.stop();
    if (!desktop.getAudioTracks().length) {
      for (const t of desktop.getTracks()) t.stop();
      throw new Error('Nguồn hệ thống không có âm thanh — trên Windows hãy tick "Chia sẻ âm thanh hệ thống"; macOS có thể không hỗ trợ (dùng chế độ Chỉ mic).');
    }
    themStream = new MediaStream(desktop.getAudioTracks());
  }

  // Mic: bắt buộc ở chế độ mic-only; tuỳ chọn ở các chế độ khác.
  // mic-only tắt EC/NS để không triệt tiếng đối phương phát qua loa (FR-041).
  let micStream = null;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: micConstraints(mode) });
  } catch (e) {
    if (mode === 'mic') throw new Error('Chế độ Chỉ mic cần quyền microphone: ' + e.message);
    // các chế độ khác: không có mic vẫn ghi được phía đối phương
  }

  // tabCapture làm tab bị mute → phát lại cho người dùng nghe. Desktop capture KHÔNG mute
  // nguồn nên không passthrough (tránh vọng — FR-040).
  let playCtx = null;
  if (caps.passthrough && themStream) {
    playCtx = new AudioContext();
    playCtx.createMediaStreamSource(themStream).connect(playCtx.destination);
    await playCtx.resume();
  }

  // Context 16kHz: mix để ghi file + tap PCM để phiên âm live
  const ctx = new AudioContext({ sampleRate: SR });
  await ctx.audioWorklet.addModule(chrome.runtime.getURL('offscreen/pcm-capture.worklet.js'));
  const tap = new AudioWorkletNode(ctx, 'pcm-capture', {
    numberOfInputs: 2,
    numberOfOutputs: 0,
  });
  const mixDest = ctx.createMediaStreamDestination();

  if (themStream) {
    const themSrc = ctx.createMediaStreamSource(themStream);
    themSrc.connect(tap, 0, 1);
    themSrc.connect(mixDest);
  }
  if (micStream) {
    const micSrc = ctx.createMediaStreamSource(micStream);
    micSrc.connect(tap, 0, 0);
    micSrc.connect(mixDest);
  }
  await ctx.resume();

  // Nguồn kết thúc đột ngột (tab đóng / Stop sharing / mic rút) → chốt phiên (FR-020/042)
  const watchTrack = themStream?.getAudioTracks()[0] || micStream?.getAudioTracks()[0];
  watchTrack?.addEventListener('ended', () => {
    if (session && !session.stopped) stopRecording().catch((e) => console.error('[source-ended]', e));
  });

  const meetingId = uid();
  // Chế độ "chỉ phụ đề, không lưu" (FR-027): không recorder, không chunk, không record DB.
  let recorder = null;
  const pendingWrites = new Set();
  if (!ephemeral) {
    recorder = new MediaRecorder(mixDest.stream, {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 64000,
    });
    // Crash-safe (FR-016): persist từng chunk 5s vào IndexedDB ngay khi có — không giữ RAM.
    // Chuỗi chunk WebM ghép từ chunk 0 là stream prefix hợp lệ nên phát lại được dù cụt đuôi.
    let seq = 0;
    recorder.ondataavailable = (e) => {
      if (!e.data.size) return;
      const p = putAudioChunk(meetingId, seq++, e.data).catch((err) =>
        console.error('[chunk-persist]', err)
      );
      pendingWrites.add(p);
      p.finally(() => pendingWrites.delete(p));
    };
    recorder.start(5000);
  }

  const startedAt = Date.now();
  session = {
    id: meetingId,
    cfg,
    mode,
    startedAt,
    themStream,
    micStream,
    playCtx,
    ctx,
    recorder,
    pendingWrites,
    ephemeral,
    segments: [],
    queue: Promise.resolve(),
    segmenter: null,
    stopped: false,
    copilotIndex,
    copilotDocsetId: copilot?.docsetId || null,
  };

  session.segmenter = new Segmenter({
    sr: SR,
    onSegment: (seg) => enqueueSegment(seg),
  });
  tap.port.onmessage = (e) => {
    if (session && !session.stopped) session.segmenter.push(e.data.mic, e.data.tab);
  };
  session.partialTimer = setInterval(partialTick, PARTIAL_TICK_MS);

  if (!ephemeral) {
    await patchMeeting(meetingId, {
      title: meta.title,
      startedAt,
      status: 'recording',
      segments: [],
      sourceLang: cfg.sourceLang,
      targetLang: cfg.targetLang,
      micUsed: !!micStream,
      liveModel: cfg.liveModel,
      sourceMode: mode,
      copilotDocsetId: copilot?.docsetId || null,
    });
  }

  // Nạp model live ngay để phụ đề ra sớm
  transcriber.load(cfg.liveModel, { device: deviceOf(cfg) }).catch((e) => console.error('load model', e));

  broadcast({
    type: 'recording-started',
    meetingId,
    startedAt,
    title: meta.title,
    micUsed: !!micStream,
    ephemeral,
    mode,
    tabId: meta.tabId,
  });
}

async function stopRecording() {
  if (!session) return;
  const s = session;
  s.stopped = true;
  clearInterval(s.partialTimer);

  // dừng recorder và các track
  if (s.recorder) {
    await new Promise((resolve) => {
      s.recorder.onstop = resolve;
      s.recorder.stop();
    });
  }
  for (const t of [...(s.themStream?.getTracks() || []), ...(s.micStream?.getTracks() || [])]) t.stop();

  broadcast({ type: 'recording-stopped', meetingId: s.id });

  // đoạn PCM còn dư → phiên âm nốt
  s.segmenter.flush();
  await s.queue; // chờ hàng đợi phiên âm live xử lý xong

  await s.ctx.close().catch(() => {});
  await s.playCtx?.close().catch(() => {});

  if (s.ephemeral) {
    // không có gì để lưu — đúng lời hứa "chỉ phụ đề" (SC-013)
    session = null;
    broadcast({ type: 'pipeline-status', meetingId: s.id, status: 'done', ephemeral: true });
    return;
  }

  const endedAt = Date.now();
  const durationMs = endedAt - s.startedAt;
  await Promise.all([...s.pendingWrites]); // chờ chunk cuối ghi xong
  const chunkRows = await getAudioChunks(s.id);
  const blob = new Blob(chunkRows.map((c) => c.data), { type: 'audio/webm' });
  await saveAudio(s.id, blob, 'audio/webm');
  await deleteAudioChunks(s.id);
  await patchMeeting(s.id, { status: 'summarizing', endedAt, durationMs, audioBytes: blob.size });
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
      transcriber.transcribe(mixed, { model: s.cfg.liveModel, language: s.cfg.sourceLang, device: deviceOf(s.cfg) })
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
      const rawSpeaker = labelSpeaker(rmsOf(mic), rmsOf(tab));
      if (!rawSpeaker) return; // im lặng
      // mic-only: hai bên trộn một kênh → không gắn nhãn sai (FR-041)
      const speaker = s.mode === 'mic' ? null : rawSpeaker;

      const mixed = mixdown(mic, tab);
      const { text } = await runExclusive(() =>
        transcriber.transcribe(mixed, { model: s.cfg.liveModel, language: s.cfg.sourceLang, device: deviceOf(s.cfg) })
      );
      if (isNoiseTranscript(text)) return;

      const translation = await translateText(text, {
        sourceLang: s.cfg.sourceLang,
        targetLang: s.cfg.targetLang,
      });

      const segment = { t0, t1, speaker, text, translation };
      s.segments.push(segment);
      if (!s.ephemeral) await patchMeeting(s.id, { segments: s.segments });
      broadcast({ type: 'live-segment', meetingId: s.id, segment });
      handleCopilot(s, segment); // fire-and-forget, không chặn pipeline (FR-038)
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
    broadcast({ type: 'pipeline-status', meetingId, status: 'transcribing', progress: 0 });

    const { settings: curSettings = {} } = await chrome.storage.local.get('settings');
    const reprocessDevice = deviceOf(curSettings);
    const cfg = {
      sourceLang: meeting.sourceLang || 'auto',
      targetLang: meeting.targetLang || null,
    };
    const oldSegments = meeting.segments || [];
    const segments = [];

    // Nhận transcript của một cửa sổ PCM 16k, gộp vào kết quả chung.
    // keepUntilSec: với cửa sổ không phải cuối, bỏ chunk bắt đầu trong vùng chồng lấn
    // (cửa sổ sau sẽ phủ) để không lặp câu.
    const handleWindow = async (pcm, offsetSec, keepUntilSec) => {
      const { text, chunks } = await runExclusive(() =>
        transcriber.transcribe(pcm, {
          model: model || 'Xenova/whisper-base',
          language: cfg.sourceLang,
          timestamps: true,
          device: reprocessDevice,
        })
      );
      for (const ch of chunks || (text ? [{ text, timestamp: [0, null] }] : [])) {
        const t = (ch.text || '').trim();
        if (isNoiseTranscript(t)) continue;
        const t0 = ch.timestamp?.[0] ?? 0;
        if (keepUntilSec != null && t0 >= keepUntilSec) continue;
        const t1 = ch.timestamp?.[1] ?? t0;
        segments.push({
          t0: t0 + offsetSec,
          t1: t1 + offsetSec,
          speaker: speakerByOverlap(oldSegments, t0 + offsetSec, t1 + offsetSec),
          text: t,
          translation: await translateText(t, cfg),
        });
      }
    };

    await decodeAndTranscribe(rec.blob, meetingId, handleWindow);

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

// -------------------------------------------------- Copilot (spec 003 US2)

// Câu hỏi của "Đối phương" → thẻ trả lời 2 tầng: trích đoạn (tức thời) + câu đề xuất
// grounded từ Gemini Nano (không đủ căn cứ → im lặng/không hiển thị — D5, SC-016).
// Nano chạy runtime riêng, không đụng mutex Whisper (FR-038).
async function handleCopilot(s, segment) {
  try {
    // mic-only không có nhãn nguồn → xét câu hỏi trên mọi câu chốt (FR-041)
    const fromThem = s.mode === 'mic' ? true : segment.speaker === 'them';
    if (!s.copilotIndex || !fromThem || !isQuestion(segment.text)) return;

    const hits = search(s.copilotIndex, [segment.text, segment.translation], { k: 3 });
    if (!hits.length) return; // dưới ngưỡng tin cậy → im lặng (FR-034)

    const excerpts = hits.map((h) => ({
      text: h.chunk.text.length > 320 ? h.chunk.text.slice(0, 320) + '…' : h.chunk.text,
      docTitle: h.chunk.docTitle,
      score: Math.round(h.score * 10) / 10,
    }));
    const card = { qT0: segment.t0, question: segment.text, excerpts };
    broadcast({ type: 'answer-card', meetingId: s.id, card });

    // tầng 2: câu đề xuất grounded (bất đồng bộ, có timeout trong prompter)
    const suggestion = await synthesizeAnswer({
      question: segment.text,
      excerpts,
      targetLang: s.cfg.targetLang || 'vi',
    });
    if (suggestion && session === s && !s.stopped) {
      broadcast({ type: 'answer-card', meetingId: s.id, card: { ...card, suggestion } });
    }
  } catch (e) {
    console.error('[copilot]', e);
  }
}

// ---------------------------------------------- decode audio cho re-transcribe

const LONG_FILE_MS = 30 * 60 * 1000; // ≥30 phút → bắt buộc streaming (RAM)
const WINDOW_SEC = 600; // cửa sổ 10 phút
const OVERLAP_SEC = 5;

/**
 * Decode blob WebM/Opus → gọi handleWindow(pcm16kMono, offsetSec, keepUntilSec) theo từng
 * cửa sổ. File ngắn hoặc thiếu WebCodecs → decodeAudioData toàn bộ (một "cửa sổ" duy nhất).
 * Broadcast tiến độ % qua pipeline-status (FR-017).
 */
async function decodeAndTranscribe(blob, meetingId, handleWindow) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const demux = demuxWebmOpus(buf);
  const canStream =
    typeof AudioDecoder !== 'undefined' && demux.packets.length > 0 && demux.track.codecPrivate;

  if (!canStream || demux.durationMs < LONG_FILE_MS) {
    if (!canStream && demux.durationMs >= LONG_FILE_MS) {
      console.warn('[reprocess] file dài nhưng không streaming được — decode toàn bộ, có thể nặng RAM');
    }
    const ctx = new AudioContext({ sampleRate: SR });
    const decoded = await ctx.decodeAudioData(buf.buffer);
    const mono = new Float32Array(decoded.length);
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const ch = decoded.getChannelData(c);
      for (let i = 0; i < ch.length; i++) mono[i] += ch[i] / decoded.numberOfChannels;
    }
    await ctx.close().catch(() => {});
    broadcast({ type: 'pipeline-status', meetingId, status: 'transcribing', progress: 50 });
    await handleWindow(mono, 0, null);
    broadcast({ type: 'pipeline-status', meetingId, status: 'transcribing', progress: 100 });
    return;
  }

  // Streaming: decode Opus packet theo cửa sổ bằng WebCodecs — đỉnh RAM ≈ 1 cửa sổ PCM.
  const windows = [];
  for (let start = 0; start < demux.durationMs; start += WINDOW_SEC * 1000) {
    windows.push([start, Math.min(start + (WINDOW_SEC + OVERLAP_SEC) * 1000, demux.durationMs)]);
  }
  for (let w = 0; w < windows.length; w++) {
    const [fromMs, toMs] = windows[w];
    const pcm48 = await decodeOpusRange(demux, fromMs, toMs);
    const pcm16 = downsample3x(pcm48);
    const isLast = w === windows.length - 1;
    await handleWindow(pcm16, fromMs / 1000, isLast ? null : WINDOW_SEC);
    broadcast({
      type: 'pipeline-status',
      meetingId,
      status: 'transcribing',
      progress: Math.round(((w + 1) / windows.length) * 100),
    });
  }
}

/** Decode các packet trong [fromMs, toMs] → Float32 mono 48kHz. */
function decodeOpusRange(demux, fromMs, toMs) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let total = 0;
    const decoder = new AudioDecoder({
      output: (audioData) => {
        const n = audioData.numberOfFrames;
        const chans = audioData.numberOfChannels;
        const mono = new Float32Array(n);
        const tmp = new Float32Array(n);
        for (let c = 0; c < chans; c++) {
          audioData.copyTo(tmp, { planeIndex: c, format: 'f32-planar' });
          for (let i = 0; i < n; i++) mono[i] += tmp[i] / chans;
        }
        audioData.close();
        parts.push(mono);
        total += n;
      },
      error: reject,
    });
    decoder.configure({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: demux.track.channels || 2,
      description: demux.track.codecPrivate,
    });
    for (const p of demux.packets) {
      if (p.tsMs < fromMs - 100 || p.tsMs > toMs) continue; // 100ms preroll
      decoder.decode(
        new EncodedAudioChunk({ type: 'key', timestamp: p.tsMs * 1000, data: p.data })
      );
    }
    decoder
      .flush()
      .then(() => {
        decoder.close();
        const out = new Float32Array(total);
        let off = 0;
        for (const part of parts) {
          out.set(part, off);
          off += part.length;
        }
        resolve(out);
      })
      .catch(reject);
  });
}

/** 48kHz → 16kHz: trung bình mỗi 3 mẫu (low-pass đơn giản, đủ cho giọng nói). */
function downsample3x(pcm48) {
  const out = new Float32Array(Math.floor(pcm48.length / 3));
  for (let i = 0; i < out.length; i++) {
    const j = i * 3;
    out[i] = (pcm48[j] + pcm48[j + 1] + pcm48[j + 2]) / 3;
  }
  return out;
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
