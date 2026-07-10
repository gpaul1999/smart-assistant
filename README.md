# 🎙️ Smart Meeting Assistant — Local Recorder

Chrome Extension (Manifest V3) ghi lại toàn bộ cuộc họp/phỏng vấn online — **âm thanh của đối
phương (speaker/tab) + giọng của bạn (mic)** — phiên âm trực tiếp, dịch trực tiếp sang ngôn ngữ
bạn chọn, và tóm tắt các điểm chính sau khi kết thúc.

**Điểm khác biệt: mọi dữ liệu ở lại trên máy của bạn.** Audio, transcript, bản dịch và tóm tắt
được lưu trong IndexedDB của trình duyệt. Không có server, không có tài khoản, không upload.

## Dành cho ai

- **Người đi phỏng vấn (online)** — đặc biệt khi kỹ năng nghe ngoại ngữ chưa thành thạo:
  vừa họp vừa xem **phụ đề trực tiếp kèm bản dịch** trong cửa sổ riêng; sau buổi phỏng vấn xem
  lại từng câu **mình đã hỏi/trả lời gì** (phân biệt "Bạn" và "Đối phương") để tự đánh giá.
- **Người đi làm họp dài với khách hàng** — không sợ sót thông tin: toàn bộ lịch sử được lưu,
  kèm **tóm tắt điểm chính** và **danh sách việc cần làm (action items)** để nhớ lại từng point.

> Hai đối tượng trên dùng chung **một bộ tính năng, một pipeline** — không có "chế độ" riêng.
> Chỉ khác cách bạn tận dụng: phỏng vấn thì nhìn phụ đề live, họp dài thì đọc tóm tắt sau.

## Tính năng

| | |
|---|---|
| 🔴 Ghi âm | 3 nguồn: **Tab** (mọi trang web, tách kênh Bạn/Đối phương), **Hệ thống** (app desktop qua picker chia sẻ, vẫn tách kênh), **Chỉ mic** (mọi nơi một chạm — phỏng vấn trực tiếp/điện thoại mở loa, không nhãn người nói) + microphone, mix thành `.webm` |
| 📝 Phiên âm live | Whisper (tiny/base/small) chạy **local** (transformers.js + WASM); phụ đề tạm cập nhật mỗi ~1.2s (mục tiêu ≤2s sau khi nói), chốt câu kèm dịch khi ngắt hơi ~0.45s |
| 🌐 Dịch live | Chrome **Translator API** (Gemini Nano, **on-device**) — phụ đề song ngữ realtime |
| 🗣️ Ai đang nói | Gắn nhãn "Bạn" / "Đối phương" theo năng lượng âm của từng nguồn (mic vs tab) |
| ✨ Tóm tắt | Chrome **Summarizer API** (on-device); không có thì fallback extractive thuần JS (vi+en) |
| ✅ Action items | Tự nhặt các câu dạng "cần/sẽ làm/deadline/follow up…" (vi+en) |
| 📚 Thư viện | Nghe lại audio, đọc transcript + bản dịch, sửa tiêu đề, xuất Markdown/JSON/audio, xóa |
| 🔁 Phiên âm lại | Chạy lại từ audio đã lưu bằng model chính xác hơn (Whisper Base/Small — Small là Pro) |
| 📄 Copilot tài liệu | Dán hợp đồng/spec/CV-JD vào kho local; câu hỏi vang lên → trích đoạn khớp + câu trả lời đề xuất **có trích dẫn, không bịa** (Gemini Nano on-device). Free: dán text, kho ≤3.000 ký tự. **Pro**: nhập file (txt/md/csv/html/srt…, convert local) không giới hạn + rà soát hỏi–đáp sau buổi |

## Cài đặt (dev)

```bash
npm install --ignore-scripts   # cài deps (bỏ qua postinstall của onnxruntime-node, không cần)
npm run vendor                 # copy transformers.js + ONNX WASM vào extension/vendor/
```

Sau đó vào `chrome://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục
`extension/`.

## Sử dụng

1. Bấm icon extension → trang **Cấp quyền microphone** (một lần duy nhất).
2. Mở tab cuộc họp (Google Meet, Zoom web, Teams web…), bấm icon extension.
3. Chọn ngôn ngữ **Dịch sang** → **Bắt đầu ghi**. Cửa sổ phụ đề live tự mở (tắt được).
4. Kết thúc: bấm **Dừng ghi** → extension tóm tắt và lưu vào **📚 Thư viện cuộc họp**.

> Lần phiên âm đầu tiên cần tải model Whisper (~40–150MB tùy model) từ HuggingFace — chỉ một
> lần, sau đó cache lại và hoạt động offline.

## Kiến trúc & bảo mật dữ liệu

```
tab audio (đối phương) ─┐                    ┌→ MediaRecorder → IndexedDB (audio.webm)
                        ├→ AudioContext 16kHz┤
microphone (bạn)       ─┘                    └→ AudioWorklet tap → cắt đoạn theo khoảng lặng
                                                  → Whisper (WASM, local) → transcript
                                                  → Translator API (on-device) → bản dịch
                                             dừng ghi → Summarizer API (on-device)
                                                        / extractive fallback → tóm tắt
                                             tất cả → IndexedDB (local)
```

- **Không có bất kỳ request nào mang dữ liệu người dùng ra ngoài.** Network duy nhất: tải trọng
  số model Whisper từ `huggingface.co` lần đầu (chỉ tải về, được cache bằng Cache API).
- Dịch & tóm tắt dùng model **on-device** của Chrome (Gemini Nano, Chrome 138+). Máy chưa hỗ trợ
  → tự fallback: không dịch + tóm tắt extractive local. Không bao giờ gọi cloud API.
- Xóa cuộc họp trong Thư viện = xóa vĩnh viễn khỏi IndexedDB.

## Phát triển

```bash
npm test          # unit tests (node --test + fake-indexeddb)
npm run test:e2e  # E2E: load extension thật vào Chromium (Playwright), có screenshot bằng chứng
```

Quy tắc & routing skill cho AI agent: xem [CLAUDE.md](CLAUDE.md) (theo bộ skill
[base-project-require-skills](https://github.com/gpaul1999/base-project-require-skills)).

## Độ bền (v0.2 — spec 001)

- **Crash-safe**: audio được lưu từng chunk 5 giây ngay khi ghi; trình duyệt/máy sập giữa
  chừng → lần mở sau phiên xuất hiện với badge "gián đoạn", nghe lại được tới ~10s trước
  khi sập, transcript còn nguyên.
- **Phiên dài (tới ~3 giờ)**: phiên âm lại chạy streaming theo cửa sổ 10 phút (WebCodecs +
  demuxer WebM/Opus tự viết) — không decode cả file vào RAM; có thanh tiến độ.
- **Tab họp đóng đột ngột** = tự chốt phiên như bấm Dừng.
- **Model lần đầu**: nút "Chuẩn bị model trước khi họp" + % tiến độ trong popup.
- **Dung lượng**: quota bar trong popup/thư viện, cảnh báo từ 70%, chặn ghi mới khi ≥90%.

## Giới hạn hiện tại

- Whisper tiny/base đủ dùng cho tiếng Anh; tiếng Việt nên chọn Whisper Small (Nâng cao).
  WebGPU + tự chọn model theo máy nằm trong spec 002.
- Độ trễ phụ đề tạm ≤2s là mục tiêu với Whisper Tiny trên máy hiện đại; máy yếu/model to hơn
  sẽ chậm hơn (partial tự bỏ nhịp khi inference bận, không dồn hàng đợi — câu chốt không bao giờ mất).
