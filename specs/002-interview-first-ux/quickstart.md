# Quickstart — kiểm chứng 002-interview-first-ux

## Gate tự động

```bash
npm test          # + license (Ed25519 sign/verify/tamper/expiry), model-policy, i18n helper
npm run test:e2e  # + onboarding 3 bước, overlay inject trang test, panel Dữ liệu, popup Pro/ephemeral
npm run pack      # zip store-ready tại dist/ (FR-026)
```

## Kịch bản thủ công

- **G. Onboarding (SC-009)**: xóa profile Chrome test → load extension → trang chào tự mở;
  đi 3 bước (mic → ngôn ngữ → nói thử một câu thấy phụ đề + dịch); bấm giờ ≤3 phút kể cả
  tải model; đóng giữa chừng → popup nhắc quay lại.
- **H. Overlay (SC-010)**: ghi trên tab bất kỳ (http) → phụ đề hiện trong tab, kéo-thả,
  A± đổi cỡ, vị trí được nhớ theo domain; trang chặn inject → cửa sổ live tự mở kèm lý do.
- **I. Benchmark/WebGPU (SC-011)**: máy có WebGPU → Nâng cao hiển thị model được chọn cao
  hơn ít nhất 1 bậc so khi ép WASM; đo độ trễ phụ đề vẫn ≤2s.
- **J. Chỉ-phụ-đề (SC-013)**: bật checkbox → ghi → dừng → thư viện KHÔNG có mục mới;
  DevTools kiểm tra IndexedDB không có record/chunk mới.
- **K. Nudge (FR-028)**: mở meet.google.com → badge ● + notification một lần; tắt setting
  → hết notification.
- **L. License (FR-029)**: dán key test (sinh bằng `node scripts/make-license.mjs` với
  private key dev) → popup hiện Pro; sửa 1 ký tự → báo key không hợp lệ; network tab: 0 request.
- **M. Store zip (SC-012)**: `npm run pack` → upload dashboard không lỗi cấu trúc.

## Kết quả kiểm chứng

| Ngày | Hạng mục | Kết quả |
|---|---|---|
| 2026-07-06 | Gate tự động (`npm test` + E2E) | ✅ 55 unit + 16 E2E xanh (license sign/verify/tamper/expiry, model-policy, i18n key-parity, onboarding steps, overlay render, panel Dữ liệu) |
| 2026-07-06 | `npm run pack` | ✅ dist/smart-meeting-assistant-0.3.0.zip (5.3MB) |
| — | G/H/I/J/K/L/M thủ công trên máy thật | ⏳ chờ chủ dự án (cần mic/loa/WebGPU/mạng thật) |
