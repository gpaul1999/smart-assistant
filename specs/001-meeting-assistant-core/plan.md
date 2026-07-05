# Implementation Plan: Trợ lý cuộc họp local-first (baseline sản phẩm)

**Branch**: `claude/meeting-recorder-local-jsifj3` (spec dir: `001-meeting-assistant-core`) | **Date**: 2026-07-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-meeting-assistant-core/spec.md`

## Summary

Baseline sản phẩm đã chạy ở v0.1 (ghi tab+mic, phụ đề live ≤2s với interim caption, dịch
on-device, tóm tắt, thư viện, export/delete/re-transcribe — FR-001→FR-015 về cơ bản ĐÃ ĐẠT,
được xác nhận bằng 23 unit test + 7 E2E). Plan này tập trung phần CHƯA ĐẠT của spec:

- **FR-016 / SC-006**: crash-safe — persist audio chunk + transcript dần trong khi ghi,
  khôi phục phiên "gián đoạn" khi khởi động lại.
- **FR-017 / SC-007**: phiên 3 giờ — re-transcribe streaming theo cửa sổ (WebCodecs
  AudioDecoder + demuxer WebM/Opus tối giản) thay vì decode toàn bộ vào RAM.
- **FR-018**: UX tải model lần đầu — tiến độ % ở popup/cửa sổ phụ đề + nút "chuẩn bị trước".
- **FR-019**: quản lý dung lượng — `navigator.storage.estimate()` + persistent storage +
  cảnh báo ngưỡng.
- **FR-020**: tab họp đóng đột ngột → tự chốt phiên như bấm dừng.
- **SC-008**: harness đo chất lượng nhãn người nói trên fixture hai người nói.

## Technical Context

**Language/Version**: JavaScript ES2022 (ES modules thuần, không build step — Constitution II)

**Primary Dependencies**: `@huggingface/transformers` 3.5.2 (vendor vào `extension/vendor/`,
Whisper WASM); Chrome built-in AI (Translator/Summarizer/LanguageDetector — on-device);
Web Audio (AudioWorklet), MediaRecorder, WebCodecs (`AudioDecoder`, mới dùng cho FR-017)

**Storage**: IndexedDB — store `meetings` (metadata+transcript+summary), `audio` (blob hoàn
chỉnh), `audio_chunks` (MỚI — chunk 5s đang ghi, phục vụ crash-safe); Cache API cho model

**Testing**: `node --test` + fake-indexeddb (lib thuần); Playwright E2E load extension thật
vào Chromium (skill `playwright-e2e`), screenshot làm bằng chứng

**Target Platform**: Chrome desktop ≥138 (Translator/Summarizer API), Manifest V3

**Project Type**: Chrome Extension MV3 (service worker + offscreen document + UI pages)

**Performance Goals**: phụ đề tạm ≤2s (SC-001); thư viện sẵn sàng ≤60s sau khi dừng phiên
60' (SC-004); re-transcribe 3h không vượt ~1.5GB RAM đỉnh (SC-007, máy 8GB)

**Constraints**: local-first tuyệt đối — zero network mang dữ liệu người dùng (Constitution
I, SC-003); offline hoàn toàn sau lần tải model đầu (FR-015); degrade mượt trên máy yếu
(Constitution VI); mất tối đa 10s dữ liệu khi crash (SC-006)

**Scale/Scope**: 1 người dùng/máy; phiên tới 3 giờ; thư viện hàng trăm phiên (~50MB audio/giờ)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Đánh giá | Ghi chú |
|---|---|---|
| I. Local-first tuyệt đối | ✅ PASS | Không thêm network call nào; WebCodecs/storage.estimate đều là API local |
| II. Simplicity First | ✅ PASS | Không dep mới; demuxer WebM/Opus tự viết ~200 dòng trong `lib/` (biện minh: thêm thư viện demuxer bên thứ ba là rủi ro supply-chain lớn hơn — xem research.md R2) |
| III. Lib environment-agnostic | ✅ PASS | Demuxer, logic recovery, quota policy đặt trong `extension/lib/*` thuần, test bằng Node |
| IV. Test đi kèm | ✅ PASS | Mỗi FR gap có unit test; recovery + storage UI có E2E |
| V. Một pipeline chung | ✅ PASS | Không thêm mode; crash-safe/quota là thuộc tính của pipeline hiện có |
| VI. Hiệu năng & degrade mượt | ✅ PASS | Re-transcribe theo cửa sổ có tiến độ; persist chunk không chạm đường nóng audio (ghi IDB bất đồng bộ ngoài AudioWorklet) |

**Kết luận Gate**: PASS — không có vi phạm cần justify. (Re-check sau Phase 1: PASS, xem cuối file.)

## Project Structure

### Documentation (this feature)

```text
specs/001-meeting-assistant-core/
├── spec.md              # Đặc tả (đã xong)
├── checklists/requirements.md
├── plan.md              # File này
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1 — kịch bản kiểm chứng end-to-end
├── contracts/
│   └── messages.md      # Phase 1 — contract message bus nội bộ extension
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
extension/
├── background.js            # + xử lý tab-closed, khởi động recovery
├── offscreen/
│   ├── offscreen.js         # + persist chunk dần, rotate recorder, recovery, re-transcribe streaming
│   └── pcm-capture.worklet.js
├── lib/
│   ├── db.js                # + store audio_chunks, API recovery/quota
│   ├── segmenter.js
│   ├── transcriber.js       # + transcribe theo cửa sổ có tiến độ
│   ├── webm-opus.js         # MỚI: demuxer EBML/WebM → Opus packets (thuần, test Node)
│   ├── recovery.js          # MỚI: logic phát hiện & khôi phục phiên gián đoạn (thuần)
│   ├── storage-policy.js    # MỚI: ngưỡng cảnh báo quota, ước lượng dung lượng phiên (thuần)
│   ├── summarizer.js
│   ├── translator.js
│   └── format.js
├── popup/                   # + hiển thị quota, tiến độ model, nút "chuẩn bị model"
├── live/                    # + tiến độ model
└── viewer/                  # + badge "gián đoạn", quota bar, tiến độ re-transcribe

tests/
├── unit/                    # + webm-opus, recovery, storage-policy, speaker-label harness
└── e2e/                     # + recovery flow, quota UI, model progress UI
```

**Structure Decision**: giữ nguyên cấu trúc extension hiện có (một project, không tách);
mọi logic mới testable đặt ở `extension/lib/*` theo Constitution III.

## Complexity Tracking

Không có vi phạm Constitution — bảng này để trống. Điểm phức tạp duy nhất đáng ghi:
demuxer WebM tự viết (xem research.md R2 cho lý do chọn thay vì thư viện ngoài
hoặc thay đổi định dạng ghi).

## Constitution Re-check (post Phase 1)

Thiết kế data-model (store `audio_chunks` xóa sau khi phiên chốt thành công) và contract
message không tạo network call, không tạo mode theo persona, không thêm dependency ngoài
→ vẫn PASS cả 6 nguyên tắc.
