# Chính sách quyền riêng tư / Privacy Policy — Smart Meeting Assistant

*Cập nhật / Last updated: 2026-07-06*

## Tiếng Việt

Smart Meeting Assistant được thiết kế **local-first tuyệt đối**:

- **Chúng tôi không thu thập bất kỳ dữ liệu nào.** Không analytics, không telemetry,
  không tài khoản.
- Audio, transcript, bản dịch, tóm tắt và mọi cài đặt được xử lý và lưu **duy nhất trong
  trình duyệt trên máy của bạn** (IndexedDB / chrome.storage). Chúng không bao giờ được
  gửi tới máy chủ nào — của chúng tôi hay của bên thứ ba.
- Kết nối mạng duy nhất của extension: **tải trọng số model nhận dạng giọng nói
  (Whisper) từ huggingface.co một lần** rồi cache lại. Yêu cầu tải này không chứa dữ
  liệu người dùng. Sau đó extension hoạt động hoàn toàn offline.
- Dịch và tóm tắt dùng các API on-device của Chrome (Gemini Nano) — cũng chạy trên máy bạn.
- Xóa cuộc họp (hoặc "Xóa toàn bộ dữ liệu") là xóa vĩnh viễn khỏi máy. License key Pro
  (nếu có) được xác thực offline bằng chữ ký số, không gửi đi đâu.
- **Trách nhiệm ghi âm**: luật ghi âm cuộc gọi khác nhau theo khu vực; bạn chịu trách
  nhiệm tuân thủ nơi bạn sử dụng. Chế độ "chỉ phụ đề, không lưu" luôn khả dụng.

## English

Smart Meeting Assistant is strictly **local-first**:

- **We collect nothing.** No analytics, no telemetry, no accounts.
- Audio, transcripts, translations, summaries and settings are processed and stored
  **only inside your browser on your machine** (IndexedDB / chrome.storage). They are
  never sent to any server — ours or anyone else's.
- The extension's only network activity is a **one-time download of the speech model
  weights (Whisper) from huggingface.co**, which is then cached. That request carries no
  user data. Everything afterwards works fully offline.
- Translation and summarization use Chrome's on-device AI (Gemini Nano) — also local.
- Deleting a meeting (or "Delete all data") permanently removes it from your machine.
  Pro license keys are verified offline via digital signature and are never transmitted.
- **Recording responsibility**: call-recording laws vary by region; you are responsible
  for compliance where you use it. A "captions only, no saving" mode is always available.

Liên hệ / Contact: https://github.com/gpaul1999/smart-assistant/issues
