# Quickstart — kiểm chứng 004-audio-source-anywhere

## Gate tự động
`npm test` (+ source-mode capabilities) và `npm run test:e2e` (+ selector 3 chế độ,
mic-mode bật nút ghi không cần tab, persist setting).

## Kịch bản thủ công (máy thật)
- **S. Hệ thống (Windows)**: mở Zoom app → popup chọn "Hệ thống" → ghi → picker hiện,
  chọn màn hình + tick chia sẻ âm thanh → phụ đề cửa sổ riêng chạy, nhãn Bạn/Đối phương
  đúng; bấm "Stop sharing" → phiên tự chốt. (macOS: nếu nguồn không có audio → thông báo
  hướng sang Chỉ mic — SC-022.)
- **T. Chỉ mic**: đối phương nói qua loa (điện thoại/trực tiếp) → chọn "Chỉ mic" → một
  click là ghi (SC-021); phụ đề + dịch chạy; transcript KHÔNG có nhãn người nói; Copilot
  vẫn bắt câu hỏi.
- **U. Từ chối picker hệ thống** → lỗi hiển thị rõ trong popup, không treo phiên.

## Kết quả kiểm chứng
| Ngày | Hạng mục | Kết quả |
|---|---|---|
| 2026-07-06 | Gate tự động | ✅ 70 unit + 20 E2E xanh |
| — | S/T/U thủ công | ⏳ chờ chủ dự án |
