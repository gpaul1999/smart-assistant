# Data Model — 001-meeting-assistant-core (Phase 1)

IndexedDB `smart-assistant`, version 2 (migration từ v1: thêm store `audio_chunks`).

## Store `meetings` (keyPath: `id`)

| Field | Type | Ghi chú |
|---|---|---|
| `id` | string | `m_<ts36>_<rand>` |
| `title` | string | sửa được (FR-011) |
| `startedAt` / `endedAt` | number (epoch ms) | |
| `durationMs` | number | |
| `status` | enum | `recording` → `summarizing`/`transcribing` → `done` \| `error` \| **`interrupted`** (MỚI, FR-016) |
| `errorMsg` | string? | khi `status='error'` |
| `sourceLang` | string | `auto` hoặc BCP-47 |
| `targetLang` | string \| null | null = không dịch |
| `micUsed` | boolean | FR-003 |
| `liveModel` / `accurateModel` | string | id model đã dùng |
| `segments` | Segment[] | persist dần từng câu chốt (crash-safe transcript) |
| `summary` | Summary? | |

### Segment

| Field | Type | Ghi chú |
|---|---|---|
| `t0`, `t1` | number (giây) | offset từ đầu phiên |
| `speaker` | `'me'` \| `'them'` \| `'both'` \| null | FR-007; null khi re-transcribe không khớp được |
| `text` | string | bản gốc |
| `translation` | string? | FR-008 |

### Summary

| Field | Type |
|---|---|
| `method` | `'gemini-nano'` \| `'extractive'` \| `'none'` |
| `keyPoints` | string[] |
| `keyPointsTranslated` | string[]? |
| `actionItems` | string[] |

## Store `audio` (keyPath: `id`)

| Field | Type | Ghi chú |
|---|---|---|
| `id` | string | = meeting id (1-1) |
| `blob` | Blob | WebM/Opus hoàn chỉnh (hoặc prefix hợp lệ nếu khôi phục từ crash) |
| `mimeType` | string | `audio/webm` |

## Store `audio_chunks` (MỚI — keyPath: `[meetingId, seq]`)

Chunk 5s từ MediaRecorder, persist ngay khi có (R1). **Vòng đời**: ghi trong phiên →
(a) phiên dừng bình thường: ghép thành `audio`, xóa hết chunks; (b) crash: lần khởi động
sau, recovery ghép prefix → `audio`, status meeting → `interrupted`, xóa chunks.

| Field | Type | Ghi chú |
|---|---|---|
| `meetingId` | string | |
| `seq` | number | thứ tự, tăng từ 0 (chunk 0 chứa WebM header) |
| `data` | Blob | ~5s Opus |

**Invariant**: tại mọi thời điểm, với một `meetingId`, dãy `seq` liên tục từ 0 (thiếu chunk
giữa chừng ⇒ chỉ ghép tới trước chỗ thiếu).

## State transitions (Meeting.status)

```
            bấm ghi                dừng / tab đóng (FR-020)
   (new) ──────────▶ recording ───────────────────────────▶ summarizing ──▶ done
                        │                                        │
                        │ crash + recovery (FR-016)              │ lỗi
                        ▼                                        ▼
                   interrupted ◀─── (giữ audio prefix +        error
                        │            transcript đã persist)
                        │ re-transcribe (FR-013/FR-017)
                        ▼
                   transcribing ──▶ summarizing ──▶ done
```

## Settings (chrome.storage.local, key `settings`) — một bộ cho mọi phiên (Constitution V)

| Field | Default | Ghi chú |
|---|---|---|
| `liveModel` | `Xenova/whisper-tiny` | SC-001 |
| `accurateModel` | `Xenova/whisper-base` | FR-013 |
| `sourceLang` | `auto` | |
| `targetLang` | `vi` | null = tắt dịch |
| `openLiveWindow` | `true` | |

## Validation rules

- `deleteMeeting(id)` PHẢI xóa ở cả 3 store (`meetings`, `audio`, `audio_chunks`) — FR-012.
- Meeting `recording` không có heartbeat phiên hiện hành ⇒ đối tượng của recovery.
- `storage-policy`: `warn` ≥70% quota, `critical` ≥90%; `critical` chặn phiên mới (FR-019).
