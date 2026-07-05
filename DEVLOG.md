# DEVLOG — smart-assistant

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
