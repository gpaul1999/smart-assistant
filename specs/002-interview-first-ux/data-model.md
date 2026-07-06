# Data Model — 002-interview-first-ux (Phase 1)

IndexedDB không đổi (schema v2 của 001). Mọi thứ mới nằm ở `chrome.storage.local`.

## `settings` (mở rộng từ 001)

| Field | Type | Default | Ghi chú |
|---|---|---|---|
| `captionMode` | `'overlay'\|'window'\|'off'` | `'overlay'` | FR-024 (D4); overlay lỗi → runtime fallback window |
| `ephemeralDefault` | boolean | `false` | trạng thái checkbox "chỉ phụ đề" lần trước |
| `meetingNudge` | boolean | `true` | FR-028 |
| `bench` | `{device:'webgpu'\|'wasm', rtfTiny:number, rtfBase:number\|null, pickedAt:number}` | null | FR-022/023; null = chưa benchmark |
| `liveModel`/`accurateModel` | string | từ `model-policy` sau benchmark | user override ở Nâng cao |

## `onboarding` (mới)

| Field | Type | Ghi chú |
|---|---|---|
| `step` | 0–3 | bước đã hoàn thành; 3 = xong |
| `noticeSeen` | boolean | FR-027 first-run notice |
| `completedAt` | number? | |

## `overlayPrefs` (mới — keyed theo origin)

`{ [origin]: { x: number, y: number, fontPx: number, enabled: boolean } }`

## `license` (mới)

| Field | Type | Ghi chú |
|---|---|---|
| `key` | string | `SMA1.<payload-b64url>.<sig-b64url>` |
| `plan` | `'pro'` | từ payload sau verify |
| `sub` | string | định danh mua hàng (không liên kết dữ liệu họp) |
| `exp` | number? | epoch s; hết hạn → coi như free |
| `verifiedAt` | number | verify lại khi mở popup/viewer (offline, rẻ) |

## Phiên ephemeral (FR-027)

KHÔNG có record trong IndexedDB: `session.ephemeral=true` → bỏ MediaRecorder + chunk +
patchMeeting; segments chỉ tồn tại trong RAM/broadcast. `recording-started` mang cờ
`ephemeral` để UI ghi rõ "phiên không lưu".

## Ràng buộc

- Xóa toàn bộ dữ liệu (FR-030) = clear 3 store IndexedDB; giữ `settings`/`onboarding`
  (là cấu hình, không phải dữ liệu họp) — nêu rõ trong UI.
- `license` verify offline mỗi lần đọc; KHÔNG gửi key đi đâu trong v1.
- `bench` chạy lại khi user bấm "đo lại" hoặc khi `device` thay đổi (mất WebGPU).
