# Contract 002 — mở rộng message bus (bổ sung trên contract của 001)

## Lệnh mới / mở rộng

| type | Từ → Đến | Payload | Ghi chú |
|---|---|---|---|
| `start-recording` | popup → background | + `ephemeral?: boolean` | FR-027 |
| `offscreen-start` | background → offscreen | + `ephemeral?: boolean` | |
| — | — | — | *(đã bỏ trong implement: benchmark + "nói thử" chạy NGAY TRONG trang onboarding — dùng chung lib, model cache chia sẻ qua Cache API; kết quả ghi vào `settings.bench` cho offscreen đọc. Đơn giản hơn 2 lệnh RPC.)* |

## Relay tới content script (FR-024 — content script không nhận runtime broadcast)

Background giữ `recordingTabId`; với mỗi broadcast `live-partial` / `live-segment` /
`recording-stopped` từ offscreen → `chrome.tabs.sendMessage(recordingTabId, msg)`.
Content script `content/overlay.js` lắng nghe `chrome.runtime.onMessage` (message từ
tabs.sendMessage tới đúng tab). Inject thất bại → background mở cửa sổ live (fallback),
broadcast `overlay-fallback {reason}` cho popup hiển thị.

## Sự kiện mới

| type | Nguồn | Payload | Consumer |
|---|---|---|---|
| `recording-started` | offscreen | + `ephemeral` | UI ghi rõ phiên không lưu |
| `overlay-fallback` | background | `reason` | popup/live |

## Ràng buộc

1. Overlay chỉ là consumer — không message nào từ content script điều khiển pipeline
   ngoài `stop-recording` (nút dừng trên overlay).
2. `onboarding-transcribe` dùng chung Transcriber/mutex với live (runExclusive) — không
   phá SC-001 khi (hiếm) chạy song song.
3. Không message nào mang license key ra ngoài extension.
