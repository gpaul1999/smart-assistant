# Quickstart — kiểm chứng 001-meeting-assistant-core

Hướng dẫn chạy và các kịch bản kiểm chứng end-to-end chứng minh spec hoạt động.

## Chuẩn bị

```bash
npm install --ignore-scripts && npm run vendor
```

Chrome ≥138 → `chrome://extensions` → Developer mode → Load unpacked → chọn `extension/`.

## Kiểm chứng tự động (quality gate — Constitution IV)

```bash
npm test          # unit: lib thuần (segmenter, summarizer, db, format, webm-opus, recovery, storage-policy, speaker-label harness)
npm run test:e2e  # Playwright: load extension thật, screenshot tại tests/e2e/.artifacts/
```

Kỳ vọng: toàn bộ xanh. Harness nhãn người nói in accuracy — PHẢI ≥90% (SC-008).

## Kịch bản thủ công

### A. Luồng lõi (US1–US3 / SC-001, SC-004)

1. Mở tab phát hội thoại (video YouTube hội thoại hoặc Google Meet thật), bấm icon → cấp
   quyền mic (lần đầu) → "Bắt đầu ghi".
2. Cửa sổ phụ đề mở: nói/nghe và bấm giờ từ lời nói → chữ tạm xuất hiện: **≤2s** (SC-001);
   ngắt hơi → câu chốt + bản dịch thay thế.
3. Dừng ghi → mở Thư viện: audio phát được, transcript có nhãn Bạn/Đối phương, tóm tắt +
   action items hiện trong **≤60s** với phiên 60' (SC-004).

### B. Local-first (SC-003 / FR-014, FR-015)

1. Mở DevTools → Network của offscreen page và service worker trong suốt một phiên.
2. Kỳ vọng: chỉ thấy request tới huggingface.co (lần đầu, tải model); không request nào khác.
3. Ngắt mạng (offline) → lặp lại kịch bản A: mọi thứ vẫn chạy.

### C. Crash-safe (FR-016 / SC-006)

1. Ghi ≥1 phút, kill process Chrome (`kill -9` / Task Manager).
2. Mở lại Chrome + viewer: mục có badge **"gián đoạn"**, audio phát được tới ~thời điểm sập
   (mất ≤10s cuối), transcript còn nguyên các câu đã chốt.

### D. Phiên dài & re-transcribe (FR-017 / SC-007)

1. Ghi phiên dài (hoặc seed audio 3h vào IndexedDB bằng script test).
2. Viewer → "Phiên âm lại" với Whisper Small: có thanh tiến độ; theo dõi RAM (Task Manager
   Chrome) không vượt ~1.5GB; kết quả thay transcript cũ, giữ nhãn người nói.

### E. Model lần đầu (FR-018 / SC-005) & quota (FR-019)

1. Xóa cache: DevTools → Application → Cache Storage → xóa transformers-cache → bắt đầu ghi:
   popup/cửa sổ phụ đề hiển thị **% tải model**; lần 2 không tải lại. Nút "Chuẩn bị model"
   trong popup chạy được trước khi họp.
2. Viewer hiển thị quota bar + dung lượng từng phiên; khi usage ≥70% quota hiện cảnh báo,
   ≥90% popup chặn ghi mới kèm hướng dẫn dọn.

### F. Tab đóng đột ngột (FR-020)

Đang ghi → đóng tab họp → phiên tự chốt như bấm dừng: thư viện có mục hoàn chỉnh kèm tóm tắt.

## Tham chiếu

- Yêu cầu & tiêu chí đo: [spec.md](spec.md) · Thiết kế dữ liệu: [data-model.md](data-model.md)
- Contract message: [contracts/messages.md](contracts/messages.md) · Quyết định kỹ thuật: [research.md](research.md)
