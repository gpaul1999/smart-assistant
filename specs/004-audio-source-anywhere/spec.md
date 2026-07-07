# Feature Specification: Nguồn âm mọi nơi (tab / hệ thống / chỉ mic)

**Feature Branch**: `004-audio-source-anywhere` · **Created**: 2026-07-06 · **Status**: Approved (chủ dự án chốt 2026-07-06: thêm CẢ HAI chế độ mới)

**Input**: "Bất kỳ khi nào bật lên đều nghe được cả hai bên, không nhất thiết Meet/Zoom/Teams."
Làm rõ kỹ thuật: tab mode vốn đã chạy mọi tab web; phần thiếu là (a) cuộc họp trong **app
desktop** và (b) tình huống **ngoài máy tính** (trực tiếp/điện thoại mở loa). Trình duyệt
không cho phép cấp quyền system-audio vĩnh viễn — mỗi phiên hệ thống phải qua picker (giới
hạn bảo mật, không lách được); chế độ Chỉ mic là đường "một chạm ở mọi nơi".

## User Stories

### US1 — Chế độ Hệ thống (P1): họp trong app desktop

Người dùng chọn nguồn "Hệ thống", bấm ghi → hộp chọn của Chrome hiện ra (chọn màn hình +
tick chia sẻ âm thanh) → pipeline chạy như thường: phụ đề + dịch + nhãn Bạn/Đối phương
(mic vẫn là kênh riêng) + Copilot + tóm tắt. Âm thanh hệ thống KHÔNG bị ngắt tiếng.

**Acceptance**: (1) chọn Hệ thống → picker hiện, xác nhận → phiên chạy đủ tính năng, phụ đề
ở cửa sổ riêng (không có tab để overlay); (2) bấm "Stop sharing" của trình duyệt → phiên tự
chốt như bấm Dừng; (3) từ chối picker → báo lỗi rõ, không treo.

### US2 — Chế độ Chỉ mic (P1): mọi nơi, một chạm

Người dùng chọn "Chỉ mic", bấm ghi → chạy ngay (mic đã cấp một lần), mic thu cả giọng họ
lẫn tiếng đối phương qua loa (echo-cancellation tắt để không triệt tiếng loa). Phụ đề/dịch/
Copilot/tóm tắt đầy đủ; **nhãn người nói không khả dụng** (một kênh trộn) — UI nói rõ.

**Acceptance**: (1) một click là ghi, không picker; (2) segments không có nhãn Bạn/Đối
phương, UI không hiển thị nhãn sai; (3) Copilot bắt câu hỏi trên mọi câu chốt (không lọc
theo nhãn); (4) mic track bị rút (tháo tai nghe có mic…) → phiên tự chốt.

## Functional Requirements

- **FR-039**: Popup MUST có selector nguồn âm {Tab (mặc định), Hệ thống, Chỉ mic}, nhớ lựa
  chọn; chế độ Tab yêu cầu tab http(s) như cũ; hai chế độ mới không phụ thuộc tab.
- **FR-040**: Chế độ Hệ thống MUST dùng picker của trình duyệt (desktopCapture) mỗi phiên;
  MUST không phát lại âm thanh hệ thống (tránh vọng — desktop capture không mute nguồn);
  mic vẫn là kênh riêng → nhãn người nói giữ nguyên.
- **FR-041**: Chế độ Chỉ mic MUST tắt echo-cancellation/noise-suppression để thu được
  tiếng loa; segments mang speaker=null; mọi consumer (overlay/live/viewer/export/Copilot)
  MUST xử lý speaker=null đúng (không nhãn, không lọc sai).
- **FR-042**: Nguồn "đối phương" kết thúc đột ngột (stop sharing / mic rút) MUST chốt phiên
  như bấm Dừng (mở rộng FR-020).
- **FR-043**: Meeting record MUST lưu `sourceMode`; phụ đề ở chế độ không-tab MUST tự dùng
  cửa sổ riêng bất kể captionMode.
- **FR-044**: Một pipeline duy nhất (Constitution V): ba chế độ chỉ khác tầng lấy stream.

## Success Criteria

- **SC-020**: Cả 3 chế độ chạy trọn luồng ghi→phụ đề→tóm tắt trên máy thật (kiểm thủ công).
- **SC-021**: Chế độ Chỉ mic: từ popup đến phụ đề đầu tiên không thêm bước cấp phép nào
  (mic đã cấp từ onboarding).
- **SC-022**: Chế độ Hệ thống trên Windows thu được audio app desktop; macOS ghi nhận giới
  hạn nền tảng trong UI khi không có audio track.
- **SC-023**: Gate tự động xanh; helper năng lực nguồn (lib thuần) có unit test.

## Assumptions

- macOS: system-audio qua picker phụ thuộc phiên bản Chrome/macOS — khi stream không có
  audio track, báo người dùng ngay thay vì ghi câm (edge case bắt buộc).
- Chế độ Chỉ mic chấp nhận chất lượng thấp hơn (mic thu loa); benchmark/model không đổi.
