# Contract: Message bus nội bộ extension (chrome.runtime messages)

Interface duy nhất giữa các thành phần (popup / background / offscreen / live / viewer).
Mọi message là object `{ type, ...payload }`. Thay đổi contract này PHẢI cập nhật file này
và các test liên quan.

## Lệnh (request → response `{ok, error?}`)

| type | Từ → Đến | Payload | Ghi chú |
|---|---|---|---|
| `start-recording` | popup → background | `tabId`, `tabTitle` | Từ chối khi đã có phiên (FR-005) hoặc quota `critical` (FR-019) |
| `stop-recording` | popup/live → background → offscreen | — | |
| `reprocess` | viewer → background → offscreen | `meetingId`, `model` | FR-013/FR-017 |
| `prepare-model` | popup → background | `model` | FR-018: tải model trước; background forward thành `offscreen-prepare-model` |
| `offscreen-prepare-model` | background → offscreen | `model` | vì `chrome.runtime.sendMessage` broadcast tới mọi trang, offscreen chỉ nhận type có prefix `offscreen-` |
| `offscreen-start` | background → offscreen | `streamId`, `settings`, `meta{title, tabId}` | |
| `offscreen-stop` | background → offscreen | — | |
| `offscreen-reprocess` | background → offscreen | `meetingId`, `model` | |

## Sự kiện (broadcast, không response)

| type | Nguồn | Payload | Consumer |
|---|---|---|---|
| `recording-started` | offscreen | `meetingId`, `startedAt`, `title`, `micUsed`, `openLiveWindow` | background (badge, mở live), popup, live |
| `recording-stopped` | offscreen | `meetingId` | background, popup, live |
| `recording-error` | offscreen | `error` | background, popup |
| `live-partial` | offscreen | `meetingId`, `partial{t0, t1, text, translation?}` | live — phụ đề tạm (FR-006); có thể bắn 2 lần cùng `t0` (lần sau kèm translation) |
| `live-segment` | offscreen | `meetingId`, `segment{t0, t1, speaker, text, translation?}` | live (thay phụ đề tạm cùng `t0`), viewer |
| `pipeline-status` | offscreen | `meetingId`, `status`, `error?`, `progress?` | viewer, live, popup — `progress` MỚI cho re-transcribe (FR-017) |
| `model-progress` | offscreen | `file`, `progress` (0–100) | popup, live, viewer (FR-018) |

## Ràng buộc hành vi

1. **Thứ tự phụ đề**: với cùng buffer, `live-partial(t0)` (0..n lần) luôn đến trước
   `live-segment` có cùng `t0`; UI thay thế partial bằng final theo khóa `t0`.
2. **Không mất final**: mọi câu chốt phát `live-segment` VÀ đã được persist vào
   `meetings.segments` trước khi broadcast (crash-safe transcript, FR-016).
3. **Một phiên**: `start-recording` khi `session != null` trả `{ok:false, error}` — không
   tạo phiên thứ hai (FR-005).
4. **Local-only**: không message nào chứa/kích hoạt network call mang dữ liệu người dùng
   (Constitution I).
