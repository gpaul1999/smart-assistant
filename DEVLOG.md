# DEVLOG — smart-assistant

## 2026-07-06 — Ops review (gstack plan-ceo-review): khả thi vận hành + kiếm tiền

Biên bản: `docs/ops-review-2026-07-06.md`. 9 findings: 2 CRITICAL (F1 Gemini Nano
availability trên máy thật — cần trang "Năng lực máy" + đo thật; F2 chất lượng Whisper vi
chưa dogfood), 3 HIGH (F3 permission nặng vs store review — cân nhắc bỏ nudge bản đầu;
F4 tải model HF là điểm hỏng — cần retry/resume; F5 chưa có đầu ký key khi khách trả tiền
— cần 1 webhook serverless ký Ed25519, không đụng dữ liệu họp), 4 MEDIUM (F6 bù telemetry
bằng "Xuất chẩn đoán" local; F7 hint mic-only; F8 nợ lời hứa PDF/DOCX; F9 moat bền nhất là
Copilot tài liệu — dồn marketing vào đó). Audit gate Free/Pro: gate 3.000 ký tự đúng khoảnh
khắc đau; thiếu giá trị LẶP LẠI cho Pro → đề xuất B2 "email follow-up tự soạn" (Nano local).
Roadmap 3 gói: A ops-hardening (trước beta) → store beta + demand test → B Pro value
(B2 → B1 PDF/DOCX) → C retention. Giá đề xuất: $4.99/mo · $29/năm (VN 99k/599k), key exp 1 năm.

## 2026-07-06 — D6: Copilot mở cho Free (3.000 ký tự) + Pro nhập file, convert local

Chủ dự án đổi scope: Free cũng được cung cấp tài liệu + nhận đề xuất — text dán tay, TỔNG
kho ≤3.000 ký tự (diễn giải "tối đa 3000 ký tự" thành tổng-kho để giữ giá trị nâng cấp;
đổi thành per-doc chỉ cần sửa 1 hằng số + 1 hàm trong `lib/doc-limits.js`). Pro: nhập file
text-format không giới hạn.

- `lib/doc-limits.js` (thuần): FREE_TOTAL_CHARS, assessAddition, canImportFile + tests.
- `lib/doc-import.js` (thuần): extractText theo đuôi file — stripMarkup (HTML/XML),
  stripCues (SRT/VTT), passthrough (txt/md/csv/json/yaml/log) + tests. **Đính chính
  markitdown**: là MCP Python phía dev, không chạy trong extension được; convert sản phẩm
  phải là JS local (Constitution I) — cùng tinh thần "mọi thứ → text đọc được".
- docs page: tier-info + counter x/3.000, chặn vượt hạn kèm số còn lại, nút "Nhập file
  (Pro)" (ẩn khi free); background bỏ gate Pro cho copilot live (gate giờ nằm ở tầng nhập
  kho); popup bỏ nhãn ⭐. PDF/DOCX: roadmap (pdf.js / DecompressionStream — vẫn local).

Gate: **77 unit + 20 E2E xanh** (E2E mới: hạn mức free chặn đúng "còn 500 ký tự").

## 2026-07-06 — Spec 004: nguồn âm mọi nơi (tab / hệ thống / chỉ mic)

Yêu cầu chủ dự án: "bật lên là nghe được cả hai bên, không nhất thiết Meet/Zoom/Teams".
Làm rõ: tab mode vốn chạy mọi tab web (3 domain kia chỉ là notification nhắc); phần thiếu
là app desktop + tình huống ngoài máy. Chốt (AskUserQuestion): thêm CẢ HAI chế độ.

- **Hệ thống**: `chrome.desktopCapture.chooseDesktopMedia(['screen','window','audio'])`
  từ background → streamId tiêu thụ trong offscreen bằng `chromeMediaSource:'desktop'`
  (xin kèm video rồi dừng video track) — pipeline giữ nguyên chỗ cũ, mic vẫn kênh riêng
  → GIỮ nhãn Bạn/Đối phương. Không passthrough (desktop capture không mute nguồn — tránh
  vọng). Nguồn không có audio track (macOS hạn chế) → lỗi rõ, gợi ý Chỉ mic.
  Lưu ý bảo mật trình duyệt: picker là bắt buộc mỗi phiên, không thể "cấp vĩnh viễn".
- **Chỉ mic**: một chạm mọi nơi (mic đã cấp từ onboarding); EC/NS tắt để thu tiếng loa;
  speaker=null (không gắn nhãn sai); Copilot xét câu hỏi trên mọi câu chốt.
- `lib/source-mode.js` (thuần) là nguồn chân lý năng lực từng chế độ cho popup/background/
  offscreen: {needsTab, needsPicker, hasSeparation, passthrough, overlayCapable} + tests.
- Nguồn kết thúc đột ngột (Stop sharing / mic rút) → tự chốt phiên (mở rộng FR-020).
- Permission mới: `desktopCapture`. Manifest 0.5.0. Gate: **70 unit + 20 E2E xanh**.

## 2026-07-06 — Implement spec 003: Copilot trả lời từ tài liệu (Pro) — 12/13 task

- **DB v3**: stores `docsets`/`docs`; chunk tính sẵn lúc lưu tài liệu (trang `docs/`).
- **`lib/retrieval.js`**: chunk ~1200 ký tự chồng lấn 200 + BM25 (k1=1.5, b=0.75);
  xuyên ngôn ngữ bằng query kép (câu hỏi gốc + bản dịch có sẵn từ pipeline); ngưỡng điểm
  → câu hỏi ngoài tài liệu im lặng. Test: tìm đúng điều khoản hợp đồng vi, spec en.
- **`lib/question.js`**: isQuestion vi/en (dấu ?, từ nghi vấn, đuôi câu vi) + `pairQA`
  ghép hỏi–đáp cho rà soát.
- **`lib/prompter.js`** (Prompt API/Gemini Nano): prompt grounded-only với sentinel
  KHONG_DU_CAN_CU; `parseAnswer` TỪ CHỐI output không có citation [n] (D5/SC-016 — cấm
  bịa được enforce bằng parse, không chỉ bằng prompt); timeout mọi call.
- **Flow offscreen**: câu chốt của "Đối phương" là câu hỏi → search index (nạp lúc bắt
  đầu phiên) → broadcast `answer-card` (trích đoạn, tức thời) → Nano tổng hợp → update
  card kèm 💡; Nano chạy runtime riêng, không đụng mutex Whisper (FR-038/SC-017).
- **Gate Pro ở background** (FR-037): chỉ đưa cfg copilot vào offscreen-start khi license
  verify + đã chọn docset. Overlay + cửa sổ live render card; viewer có "Rà soát phỏng
  vấn" (pairQA → đối chiếu KHOP/LECH/THIEU) lưu vào meeting.review + export Markdown.
- **DEFER**: US4 mock interview (P3) — chờ tín hiệu demand thật (D1). Manifest 0.4.0.

Gate: **64 unit + 19 E2E xanh**. Manual N–R trong quickstart 003 (cần Nano + máy thật).

## 2026-07-06 — Implement spec 002: interview-first UX (23/23 task, 2 task có ghi chú)

- **Onboarding 3 bước** tự mở sau cài (mic + notice pháp lý → ngôn ngữ → "nói thử một
  câu" bằng chính giọng user — đổi từ video mẫu vì không có asset license-sạch, aha cá
  nhân hơn). Benchmark chạy nền: đo RTF tiny/base, detect WebGPU → `lib/model-policy.js`
  tự chọn model (user không cần biết model là gì), lưu `settings.bench`.
- **WebGPU**: Transcriber nhận `device`, dtype fp16/q4 cho webgpu, tự hạ về wasm khi lỗi.
- **Overlay phụ đề trong tab họp** (D4): content script shadow-DOM inject qua
  activeTab+scripting lúc bắt đầu ghi (không host permission tĩnh); background relay
  caption qua tabs.sendMessage (content script không nhận runtime broadcast); kéo-thả +
  A± + prefs theo origin; lỗi inject → fallback cửa sổ live.
- **i18n vi/en** (`_locales` + `lib/i18n.js` env-agnostic, test key-parity 2 locale).
- **Chỉ phụ đề không lưu** (FR-027): ephemeral session — không recorder/chunk/record DB.
- **Nudge domain họp** (FR-028): badge ● + notification 1 lần/tab, không bao giờ tự ghi.
- **License Pro Ed25519 offline** (`lib/license.js`, WebCrypto — test sinh keypair/ký/
  tamper/expiry bằng Node; `scripts/make-license.mjs` cho dev). Gate đầu tiên: Whisper
  Small khi re-transcribe. Không network — đúng Constitution I.
- **Store-ready**: `npm run pack` → zip 5.3MB; `docs/privacy-policy.md` vi+en; panel
  "Dữ liệu của bạn" (đếm phiên, xóa toàn bộ 2 lớp confirm, link privacy).

Gate: **55 unit + 16 E2E xanh**. Manual còn lại: G–M trong quickstart 002 (máy thật).

## 2026-07-06 — Implement spec 001: độ bền (crash-safe, phiên 3h, model UX, quota)

Thực thi 23/26 task của `specs/001-meeting-assistant-core/tasks.md` (còn T008/T024-một-phần/
T026-phần-manual là việc đo thủ công của chủ dự án). Điểm kỹ thuật chính:

- **IndexedDB v2**: store `audio_chunks` (keyPath `[meetingId, seq]`); chunk 5s persist
  ngay trong `ondataavailable`, RAM không giữ audio nữa; dừng bình thường → ghép + dọn.
- **Recovery** (`lib/recovery.js`, thuần): meeting `recording` mồ côi → ghép prefix chunk
  (seq liên tục từ 0, thiếu thì cắt), status `interrupted`, chạy idempotent mỗi lần service
  worker khởi động lạnh.
- **Demuxer `lib/webm-opus.js`** (~200 dòng, 0 dependency): parse EBML đường-đi-hẹp cho
  WebM của Chrome MediaRecorder; chịu file cụt đuôi (chính là file recovery). Fixture test
  sinh bằng CHÍNH MediaRecorder của Chromium (`scripts/make-fixture.mjs`, 32KB, commit kèm).
- **Re-transcribe streaming**: WebCodecs `AudioDecoder` decode Opus theo cửa sổ 10' (+5s
  chồng lấn, bỏ chunk trùng ở biên), downsample 48k→16k, đỉnh RAM ≈ 1 cửa sổ; file <30'
  hoặc thiếu WebCodecs → `decodeAudioData` như cũ; broadcast progress % lên viewer.
- **`labelSpeaker` tách về `lib/segmenter.js`** + harness SC-008: hội thoại tổng hợp có
  leak 20% biên độ → accuracy 100% (ngưỡng fail <90%).
- **Quota** (`lib/storage-policy.js`): ok/warn(70%)/critical(90%) + "còn ~Xh ghi âm"
  (30MB/h); popup chặn ghi khi critical, `navigator.storage.persist()` một lần; quota bar
  cả popup lẫn viewer, dung lượng từng phiên (`audioBytes`).
- **FR-020**: `track.onended` của tab stream → `stopRecording()` (tái dùng luồng chuẩn).

Gate: **41 unit + 12 E2E xanh**. Việc còn cho chủ dự án: đo SC-004 (60s cho phiên 60'),
kịch bản B quickstart (giám sát network SC-003) và C/D thủ công trên máy thật.

## 2026-07-05 — Office hours: phản biện sản phẩm (gstack methodology)

Chạy phương pháp `/office-hours` (gstack, fork pin `11de390` — clone dùng trực tiếp, không
cài toolkit giữa session) theo yêu cầu "phản biện để thân thiện tuyệt đối + kiếm tiền".
Biên bản đầy đủ: `docs/office-hours-2026-07-05.md`. Điểm chính:

- **Phát hiện thị trường**: "local-first" không còn là vùng trống (Meetily open-source,
  Notta Privacy Mode 7/2026, Fathom free unlimited) → moat thật = live translation
  on-device trong browser + không bot + nhãn Bạn/Đối phương cho ôn phỏng vấn.
- **Rủi ro #1**: chất lượng Whisper tiny với vi/ja giết trải nghiệm đầu → benchmark máy tự
  chọn model + WebGPU nâng ưu tiên; live caption định vị "bản nháp nhanh".
- **4 quyết định founder đã chốt** (D1–D4): chưa có bằng chứng cầu (assignments bắt buộc);
  định vị wedge phỏng vấn song ngữ; freemium free-hào-phóng + Pro; overlay phụ đề trong
  tab họp làm mặc định.
- Encode thành `specs/002-interview-first-ux/spec.md` (FR-021→FR-030, SC-009→SC-013) —
  phạm vi chủ đích hẹp: đưa sản phẩm đến tay người thử đầu tiên (store beta, onboarding
  3 phút, overlay, i18n, consent, khung license). Chờ duyệt spec trước khi `/speckit-plan`.
- **D5 — Copilot trả lời từ tài liệu (spec 003)**: từ ý tưởng "interview answer mode" của
  chủ dự án, qua tranh luận ranh giới Cluely-style rồi được làm rõ thành "đề xuất trả lời
  dựa trên tài liệu user chỉ định trước (tài liệu quá lớn để nhớ)". Nguyên tắc chốt:
  grounded-only — mọi ý phải trích dẫn được về tài liệu, không căn cứ thì báo "không tìm
  thấy", 0 bịa (SC-016). Kiến trúc: chunk + truy hồi BM25 thuần JS (lib env-agnostic) →
  Gemini Nano (Prompt API, on-device, stable cho extension từ Chrome 138) tổng hợp từ
  trích đoạn. Hai tầng hiển thị: trích đoạn ≤1.5s, câu đề xuất ≤5s. Spec:
  `specs/003-interview-copilot/spec.md` (FR-031→038, SC-014→019).

## 2026-07-05 — Thiết kế bằng spec-kit (SDD) trước khi build tiếp

Theo yêu cầu chủ dự án ("dùng spec/planning skill để thiết kế đã"), cài **spec-kit** theo
bảng cài đặt §0 của base-project-require-skills (`uv tool install specify-cli`, integration
claude) — chọn spec-kit thay vì gstack vì cần artifact thiết kế bền vững, truy vết được
trong repo. Đã chạy trọn pipeline:

- `/speckit-constitution` → `.specify/memory/constitution.md` **v1.0.0** — 6 nguyên tắc:
  local-first tuyệt đối, simplicity first, lib environment-agnostic, test đi kèm, một
  pipeline chung cho mọi persona, hiệu năng ≤2s + degrade mượt.
- `/speckit-specify` → `specs/001-meeting-assistant-core/spec.md` — 5 user story (P1–P3),
  20 FR, 8 success criteria đo được; checklist chất lượng pass toàn bộ. FR-001→FR-015 đã
  đạt ở v0.1; gap: crash-safe (FR-016), phiên 3h (FR-017), model UX (FR-018), quota
  (FR-019), tab đóng (FR-020), đo nhãn người nói (SC-008).
- `/speckit-plan` → plan.md + research.md (R1–R6: persist chunk WebM prefix; demuxer
  webm-opus tự viết + WebCodecs AudioDecoder cửa sổ 10'; progress model có sẵn; storage
  policy 70/90%; track.onended; harness fixture SC-008) + data-model.md (IndexedDB v2,
  store `audio_chunks`, status `interrupted`) + contracts/messages.md + quickstart.md.
  Constitution gate: PASS cả 6 nguyên tắc, không vi phạm cần justify.
- `/speckit-tasks` → tasks.md: 26 task theo user story, MVP = Phase 2+3, ba chuỗi US5
  độc lập ship riêng được.

**Trạng thái**: chờ chủ dự án review thiết kế trước khi `/speckit-implement`.

## 2026-07-05 — Live caption độ trễ thấp (interim/partial ≤2s)

Yêu cầu từ chủ dự án: (a) hai đối tượng khách hàng dùng chung một bộ chức năng — xác nhận
kiến trúc đã vậy từ đầu, chỉ làm rõ trong README; (b) độ trễ phụ đề tối đa ~2s.

Thiết kế cũ chỉ hiện phụ đề khi chốt đoạn (≥3s nói + 0.6s lặng, max 15s) → trễ 4–15s.
Chuyển sang mô hình **interim caption** kiểu Google Meet:

- `partialTick` mỗi 1.2s phiên âm buffer đang tích lũy → broadcast `live-partial`,
  UI hiện dòng mờ/nghiêng "đang nghe…", dịch partial theo sau bất đồng bộ.
- Ngưỡng chốt câu hạ xuống: 0.45s lặng sau ≥1s nói, max window 15s → 10s (bound inference).
- **Mutex inference** (`runExclusive`): final đi qua queue tuần tự (không bao giờ mất);
  partial là lossy — Whisper đang bận thì bỏ nhịp, tránh lag lũy tiến khi máy yếu.
- Tách `Segmenter` từ offscreen.js ra `extension/lib/segmenter.js` (environment-agnostic,
  đúng nguyên tắc CLAUDE.md §3) + thêm `snapshot()` không reset buffer cho partial;
  thêm `hadVoice` để im lặng kéo dài không sinh đoạn rác. 6 unit test mới (tổng 23 + 7 E2E).

## 2026-07-05 — v0.1.0: Meeting Recorder local-first (khởi tạo)

**Quyết định kiến trúc chính:**

1. **Chrome Extension MV3, không phải web app** — chỉ extension mới capture được đồng thời
   tab audio (`chrome.tabCapture`) + mic khi họp trên Google Meet/Zoom web/Teams web.
   Web app với `getDisplayMedia` bắt người dùng chọn nguồn share mỗi lần và không đáng tin
   với audio.
2. **Local-first tuyệt đối** (yêu cầu bảo mật của chủ dự án):
   - Phiên âm: Whisper qua transformers.js/WASM chạy trong offscreen document (vendor bundle
     vào `extension/vendor/`, MV3 cấm load code từ CDN). Network duy nhất: tải trọng số model
     lần đầu từ HuggingFace, cache bằng Cache API.
   - Dịch + tóm tắt: Chrome Translator/Summarizer API (Gemini Nano, on-device, Chrome 138+),
     fallback extractive thuần JS khi không có. Không gọi cloud API nào.
   - Lưu trữ: IndexedDB (store `meetings` tách khỏi store `audio` để list không phải load blob).
3. **Hai use case định hình tính năng** (từ chủ dự án):
   - Phỏng vấn: phụ đề live + dịch live (cửa sổ riêng), phân biệt "Bạn"/"Đối phương" bằng
     so sánh RMS của mic vs tab trên từng đoạn — diarization heuristic 0 chi phí inference.
   - Họp khách hàng dài: lưu đủ lịch sử + tóm tắt key points + action items (regex vi/en).
4. **Không build step cho code extension** — ES modules thuần, load unpacked trực tiếp.
   Chỉ có script `npm run vendor` copy transformers.js + ort wasm. (Simplicity First.)
5. **Skills**: wire theo quy trình `import-skills` của base repo — vendor `playwright-e2e`
   vào `.claude/skills/`, routing block trong `CLAUDE.md`. Chỉ import skill dự án dùng.

**Bug đáng nhớ:**

- Regex `\b` của JS không hiểu Unicode → pattern action-item tiếng Việt ("nhớ", "sẽ") câm lặng.
  Fix bằng `(?:^|\P{L})…(?!\p{L})` + flag `u`. Unit test bắt được.
- Chromium test env có global `Summarizer` nhưng `create()` treo vô hạn chờ tải Gemini Nano →
  thêm timeout (mặc định 90s) quanh đường Summarizer, quá hạn rơi xuống extractive. E2E bắt được.
- CSS `display:flex` đè attribute `hidden` → thêm `[hidden]{display:none!important}`.
  Screenshot E2E bắt được.

**Test:** 17 unit (node --test + fake-indexeddb) + 7 E2E (Playwright load extension thật vào
Chromium, screenshot làm bằng chứng trong `tests/e2e/.artifacts/`). Tất cả xanh.

**Chưa làm (roadmap):**

- [ ] Lưu audio chunk dần vào IndexedDB để sống sót crash giữa phiên.
- [ ] Streaming decode khi re-transcribe để bỏ giới hạn ~1h.
- [ ] Đánh giá buổi phỏng vấn (điểm mạnh/yếu từng câu trả lời) — cần Prompt API on-device.
- [ ] Icon extension + đóng gói lên Chrome Web Store (kế hoạch monetize: freemium?).
- [ ] Xem xét WebGPU (`device:'webgpu'`) khi Chrome ổn định để phiên âm nhanh hơn nhiều lần.
