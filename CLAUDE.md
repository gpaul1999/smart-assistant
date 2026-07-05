# smart-assistant — Meeting Recorder (Local & Private)

Chrome Extension (Manifest V3) ghi âm cuộc họp (âm thanh tab/speaker + mic), phiên âm bằng
Whisper chạy **local** (transformers.js/WASM) và tóm tắt điểm chính bằng Chrome Summarizer API
(Gemini Nano, on-device) với fallback extractive thuần JS. **Toàn bộ dữ liệu người dùng nằm
trong IndexedDB của trình duyệt — không gửi audio/transcript ra ngoài.**

## Cấu trúc

- `extension/` — mã nguồn extension, load unpacked trực tiếp (không cần bước build cho code của ta).
  - `background.js` — service worker: vòng đời ghi âm, `tabCapture.getMediaStreamId`, badge.
  - `offscreen/` — offscreen document: capture tab + mic, mix bằng AudioContext, MediaRecorder,
    chạy pipeline phiên âm + tóm tắt.
  - `lib/` — module dùng chung, thuần ES module, không phụ thuộc môi trường (test được bằng Node):
    `db.js` (IndexedDB), `summarizer.js` (tóm tắt), `transcriber.js` (Whisper),
    `segmenter.js` (cắt đoạn PCM theo khoảng lặng), `format.js`.
  - `popup/`, `viewer/`, `permission/` — UI.
  - `vendor/` — transformers.js + ONNX Runtime WASM, sinh bởi `npm run vendor` (KHÔNG commit,
    KHÔNG sửa tay).
- `tests/unit/` — `node --test` + fake-indexeddb.
- `tests/e2e/` — Playwright, load extension thật vào Chromium.

## Lệnh

```bash
npm install && npm run vendor   # setup (vendor copy transformers.js vào extension/vendor/)
npm test                        # unit tests (node --test)
npm run test:e2e                # E2E Playwright (load extension vào Chromium thật)
```

## Nguyên tắc bất biến

1. **Local-first tuyệt đối**: không thêm code gửi audio, transcript, summary hay metadata cuộc họp
   tới bất kỳ server nào. Network duy nhất được phép: tải model Whisper một lần từ HuggingFace
   (được cache bằng Cache API).
2. **Simplicity First**: không thêm framework/build step khi ES module thuần đủ dùng.
3. `extension/lib/*` phải giữ environment-agnostic (không đụng `chrome.*` trực tiếp) để unit test được.

## Skills & toolkits

Tuân theo bộ quy tắc & bảng routing tại
https://github.com/gpaul1999/base-project-require-skills/blob/main/skills/README.md.

- E2E test / browser / screenshot → skill `playwright-e2e` (auto, đã vendor tại `.claude/skills/`).
- Đọc file PDF/Office/ảnh/audio → skill `markitdown` (chưa cài — nếu cần, cài theo bảng cài đặt §0
  của skills/README.md ở repo base).

Chỉ dùng toolkit đã được cài; nếu chưa cài mà cần, báo user cài trước.
