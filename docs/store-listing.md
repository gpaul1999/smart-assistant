# Chrome Web Store — listing & permission justifications (A5)

## Tên / Name
Smart Meeting Assistant — Live Captions, Translation & Recorder (100% on-device)

## Mô tả ngắn / Short description
Phụ đề + dịch trực tiếp cho phỏng vấn & cuộc họp, ghi âm và tóm tắt — mọi dữ liệu ở lại
trên máy bạn. / Live bilingual captions for interviews & meetings, recording and summaries
— everything stays on your device.

## Single purpose (bắt buộc khai với reviewer)
Capture and transcribe the user's own meetings locally: record meeting audio (tab, system
picker, or microphone), show live on-device captions/translation, and store transcripts +
summaries in the browser. No data leaves the device (see privacy policy).

## Permission justifications

| Permission | Vì sao cần / Justification |
|---|---|
| `tabCapture` | Record audio of the meeting tab the user explicitly starts recording on (user clicks the extension on that tab). |
| `desktopCapture` | Optional "System" source: user picks a screen/window via Chrome's own picker to capture desktop-app meeting audio. Invoked only on explicit user action. |
| `offscreen` | MV3 requires an offscreen document for getUserMedia/MediaRecorder and on-device Whisper (WASM) processing. |
| `storage` | User settings and local error log. Meeting data itself is in IndexedDB. |
| `activeTab` | Read the active tab's title for the session name and allow caption overlay injection on the tab the user invoked the extension on. |
| `scripting` | Inject the caption overlay (shadow DOM) into the meeting tab **only when the user starts recording there**; no static content scripts, no other sites touched. |

Đã chủ động BỎ `tabs` + `notifications` (bản đầu) để hồ sơ quyền tối thiểu — quyết định
F3, ops-review 2026-07-06.

## Yêu cầu hệ thống ghi trong listing (F1 — trung thực)
- Chrome 138+ trên desktop.
- Dịch/tóm tắt/Copilot đề xuất dùng AI on-device của Chrome (Gemini Nano) — cần máy đủ
  điều kiện (Chrome tự quản lý); không đủ thì extension vẫn ghi âm + phụ đề, tính năng AI
  tự ẩn và có trang "Năng lực máy" nói rõ.
- Lần đầu tải model nhận dạng giọng nói (~40–150MB) từ HuggingFace, sau đó offline.

## Assets cần chuẩn bị (founder)
- 5 screenshot 1280×800 (onboarding, overlay đang dịch, answer-card, thư viện, kho tài liệu).
- Video demo ≤30s quay luồng: cài → nói thử → ghi 1 cuộc họp → tóm tắt.
- Privacy policy URL: repo `docs/privacy-policy.md` (cần trang public khi repo private).
