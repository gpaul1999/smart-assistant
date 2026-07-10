# Feature Specification: Phụ đề ghim nổi (Document Picture-in-Picture)

**Feature Branch**: `005-floating-captions` · **Created**: 2026-07-06 · **Status**: Approved

**Input**: Chủ dự án: "khi người dùng làm việc ở tab khác hoặc app desktop khác, overlay
kiểu Discord/chat streamer — khả thi không?". **Làm rõ kỹ thuật**: extension không thể vẽ
đè lên app khác như Discord (cần hook OS-level); phương án trình duyệt cho phép là
**Document Picture-in-Picture** — cửa sổ nhỏ always-on-top toàn hệ điều hành, chứa DOM tùy
ý, nổi trên mọi cửa sổ (trừ game fullscreen exclusive). Overlay native thật = app companion
(Electron/Tauri + Native Messaging) — ghi nhận roadmap, ngoài phạm vi.

## User Story (P1)

Đang ghi (bất kỳ nguồn nào), người dùng bấm **"📌 Ghim nổi"** trong cửa sổ phụ đề → phụ đề
song ngữ + thẻ trả lời Copilot chuyển vào một cửa sổ mini luôn-nổi-trên-cùng; họ chuyển
sang tab khác/app desktop khác vẫn thấy phụ đề. Đóng cửa sổ nổi → phụ đề quay về cửa sổ
thường, phiên không gián đoạn.

**Acceptance**:
1. Nút Ghim nổi hiện trong cửa sổ phụ đề; bấm → cửa sổ PiP mở với phụ đề live + answer-card,
   style giữ nguyên.
2. Caption tiếp tục cập nhật realtime trong PiP; đóng PiP → nội dung quay về cửa sổ thường.
3. Trình duyệt không hỗ trợ (thiếu API) → thông báo rõ, không crash.
4. Chế độ Hệ thống/Chỉ mic: cửa sổ phụ đề gợi ý ghim nổi ngay khi mở (đúng tình huống
   người dùng sẽ rời Chrome).

## Functional Requirements

- **FR-045**: Cửa sổ phụ đề MUST có nút ghim nổi dùng Document PiP; feed phụ đề + answer
  card được CHUYỂN (không nhân bản) vào PiP và chuyển về khi PiP đóng — một nguồn render
  duy nhất (Constitution V: chỉ thêm nơi hiển thị).
- **FR-046**: Thiếu `documentPictureInPicture` MUST hiển thị thông báo yêu cầu Chrome 116+.
- **FR-047**: Khi `sourceMode ≠ tab`, cửa sổ phụ đề MUST gợi ý ghim nổi (một lần mỗi phiên).
- **SC-024**: Gate tự động xanh; kiểm chứng nổi-trên-app-desktop là kịch bản thủ công
  (headless không có window manager).
