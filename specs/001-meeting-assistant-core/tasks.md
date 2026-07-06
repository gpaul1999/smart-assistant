# Tasks: Trợ lý cuộc họp local-first (baseline sản phẩm)

**Input**: Design documents từ `specs/001-meeting-assistant-core/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/messages.md

**Bối cảnh**: FR-001→FR-015 đã hiện thực ở v0.1 (23 unit + 7 E2E xanh). Tasks dưới đây chỉ
gồm: (a) task verify/đo cho phần đã có, (b) phần gap: crash-safe, phiên 3 giờ, model UX,
quota, tab đóng, harness nhãn người nói. Test đi kèm là BẮT BUỘC theo Constitution IV.

**Organization**: Task nhóm theo user story của spec.md để mỗi story kiểm chứng độc lập được.

## Phase 1: Setup

*Không cần task setup mới — hạ tầng repo, vendor, test runner đã có từ v0.1.*

## Phase 2: Foundational (chặn các story phía sau)

- [x] T001 Nâng IndexedDB lên version 2 trong `extension/lib/db.js`: thêm store `audio_chunks`
      (keyPath `[meetingId, seq]`) + API `putAudioChunk`, `getAudioChunks(meetingId)`,
      `deleteAudioChunks(meetingId)`, `listRecordingMeetings()`; migration giữ nguyên dữ liệu v1
- [x] T002 Unit test migration + API chunk trong `tests/unit/db.test.js` (fake-indexeddb):
      round-trip chunk theo seq, xóa theo meetingId, mở db v1 rồi nâng cấp v2 không mất meetings
- [x] T003 Cập nhật `deleteMeeting` trong `extension/lib/db.js` xóa đủ 3 store
      (`meetings`, `audio`, `audio_chunks`) + unit test trong `tests/unit/db.test.js` (FR-012)

**Checkpoint**: `npm test` xanh — schema v2 sẵn sàng cho mọi story.

## Phase 3: User Story 1 — Ghi & xem lại toàn bộ nội dung (P1) 🎯 MVP

**Goal**: luồng lõi ghi→thư viện đáng tin cả khi tab họp đóng đột ngột.

**Independent Test**: quickstart.md kịch bản A + F.

- [x] T004 [US1] FR-020: trong `extension/offscreen/offscreen.js`, lắng nghe
      `track.onended`/`stream.oninactive` của tab stream → gọi `stopRecording()` (tái dùng
      luồng dừng chuẩn, không nhánh mới)
- [x] T005 [US1] E2E verify luồng lõi + đóng offscreen giữa chừng không vỡ viewer trong
      `tests/e2e/extension.spec.js` (mở rộng test hiện có; screenshot bằng chứng)

**Checkpoint**: US1 độc lập — ghi, dừng (kể cả tab đóng), xem lại đầy đủ.

## Phase 4: User Story 2 — Phụ đề trực tiếp + dịch (P2)

**Goal**: chất lượng nhãn người nói đo được, chặn regression heuristic RMS (SC-008).

**Independent Test**: quickstart.md kịch bản A bước 2 + harness tự động.

- [x] T006 [P] [US2] Tách hàm `labelSpeaker(rmsMic, rmsTab)` (ngưỡng 1.4×) từ
      `extension/offscreen/offscreen.js` về `extension/lib/segmenter.js`; offscreen import lại
- [x] T007 [US2] Harness SC-008 trong `tests/unit/speaker-label.test.js`: fixture PCM tổng hợp
      hội thoại luân phiên + chồng lấn có ground-truth → chạy qua `Segmenter`+`labelSpeaker`,
      assert accuracy ≥90%, in confusion count

**Checkpoint**: `npm test` in accuracy nhãn người nói; <90% là fail build.

## Phase 5: User Story 3 — Tóm tắt điểm chính & action items (P2)

**Goal**: đã đạt ở v0.1 — chỉ verify theo spec.

- [ ] T008 [US3] Verify SC-004 thủ công theo quickstart.md kịch bản A bước 3 và ghi kết quả
      đo vào `specs/001-meeting-assistant-core/quickstart.md` (mục kết quả)

## Phase 6: User Story 4 — Xuất / xóa / phiên âm lại (P3)

**Goal**: quyền sở hữu dữ liệu trọn vẹn với schema v2.

- [x] T009 [US4] E2E trong `tests/e2e/extension.spec.js`: xóa meeting có chunk mồ côi →
      biến mất khỏi cả 3 store (seed qua `lib/db.js` trong page context)

## Phase 7: User Story 5 — Độ bền: crash, phiên dài, lần đầu, quota (P3)

**Goal**: các thuộc tính "sản phẩm thương mại đáng tin" — phần gap chính của v0.1.

**Independent Test**: quickstart.md kịch bản C, D, E.

### Crash-safe (FR-016 / SC-006 — research R1)

- [x] T010 [US5] Persist chunk dần trong `extension/offscreen/offscreen.js`:
      `ondataavailable` → `putAudioChunk(meetingId, seq++, blob)`; dừng bình thường → ghép
      chunks thành `audio`, `deleteAudioChunks`; bỏ mảng chunks trong RAM
- [x] T011 [P] [US5] Module `extension/lib/recovery.js` (thuần): `findInterrupted(db API)`,
      `assemble(chunks)` → blob prefix hợp lệ, invariant seq liên tục từ 0 (cắt tại chỗ thiếu)
- [x] T012 [P] [US5] Unit test `tests/unit/recovery.test.js`: phát hiện meeting `recording`
      mồ côi, ghép đúng thứ tự seq, seq thiếu giữa chừng → cắt prefix, meeting rỗng chunk →
      `interrupted` không audio
- [x] T013 [US5] Chạy recovery lúc khởi động trong `extension/background.js`
      (`chrome.runtime.onStartup` + khi viewer mở): meetings `recording` mồ côi → status
      `interrupted`, audio ghép từ chunks
- [x] T014 [US5] Viewer hiển thị badge "gián đoạn" (status `interrupted`) trong
      `extension/viewer/viewer.html|js|css` + E2E seed meeting interrupted trong
      `tests/e2e/extension.spec.js`

### Phiên 3 giờ (FR-017 / SC-007 — research R2)

- [x] T015 [P] [US5] Demuxer `extension/lib/webm-opus.js` (thuần, ~200 dòng): parse EBML
      tối giản → yield `{opusPacket, timestampMs}` từ WebM do MediaRecorder Chrome sinh;
      không dependency ngoài
- [x] T016 [P] [US5] Unit test `tests/unit/webm-opus.test.js` với fixture WebM nhỏ
      (`tests/fixtures/sample.webm` sinh một lần bằng script Playwright/ffmpeg đã có sẵn
      trong môi trường CI, commit fixture nhị phân ≤200KB)
- [x] T017 [US5] Re-transcribe streaming trong `extension/offscreen/offscreen.js`:
      WebCodecs `AudioDecoder` nhận packet từ demuxer → PCM 48k → downsample 16k → cửa sổ
      10 phút chồng lấn 5s qua `Transcriber`; fallback `decodeAudioData` khi file <30 phút
      hoặc thiếu WebCodecs; broadcast `pipeline-status.progress` (0–100)
- [x] T018 [US5] Thanh tiến độ re-transcribe trong `extension/viewer/viewer.js|html`
      (consume `pipeline-status.progress` theo contract messages.md)

### Model UX (FR-018 / SC-005 — research R3)

- [x] T019 [P] [US5] Lệnh `prepare-model` theo contracts/messages.md: popup → background →
      offscreen `transcriber.load(model)`; nút "Chuẩn bị model" + % tiến độ trong
      `extension/popup/popup.html|js` (consume `model-progress`)
- [x] T020 [P] [US5] Hiển thị `model-progress` khi re-transcribe trong `extension/viewer/viewer.js`

### Quota (FR-019 — research R4)

- [x] T021 [P] [US5] Module `extension/lib/storage-policy.js` (thuần):
      `assess({usage, quota})` → `{level: ok|warn|critical, remainingHours}` (30MB/giờ);
      unit test `tests/unit/storage-policy.test.js` cho các ngưỡng 70%/90%, quota=0, thiếu API
- [x] T022 [US5] Popup: quota bar + chặn "Bắt đầu ghi" khi `critical` kèm hướng dẫn dọn,
      trong `extension/popup/popup.js|html|css`; gọi `navigator.storage.persist()` một lần
- [x] T023 [US5] Viewer: quota bar + dung lượng từng phiên trong
      `extension/viewer/viewer.js|html|css` + E2E kiểm tra hiển thị trong
      `tests/e2e/extension.spec.js`

**Checkpoint**: toàn bộ kịch bản C/D/E của quickstart.md pass.

## Final Phase: Polish & Cross-Cutting

- [ ] T024 [P] Cập nhật `README.md` (bỏ các mục "Giới hạn v0.1" đã giải quyết) và
      `DEVLOG.md` (entry thiết kế SDD + các quyết định R1–R6)
- [x] T025 [P] Cập nhật `specs/001-meeting-assistant-core/contracts/messages.md` nếu contract
      lệch trong lúc implement (giữ contract là nguồn chân lý)
- [ ] T026 Chạy full quality gate: `npm test` + `npm run test:e2e` xanh; chạy quickstart.md
      kịch bản B (giám sát network — SC-003) và ghi kết quả vào quickstart.md

## Dependencies & Execution Order

- **Phase 2 (T001–T003)** chặn T009, T010–T014 (cần schema v2). T004–T008 không phụ thuộc.
- **Trong US5**: T010 → T013 → T014 (chuỗi crash-safe); T011+T012 song song với T010;
  T015+T016 → T017 → T018 (chuỗi 3 giờ); T019/T020/T021 song song; T021 → T022 → T023.
- **Story order**: US1 (MVP) → US2 → US3 → US4 → US5; US2/US3/US4 độc lập lẫn nhau sau Phase 2.
- **[P] hợp lệ**: T006∥T011∥T015∥T019∥T021∥T024 (file khác nhau, không phụ thuộc dở dang).

## Implementation Strategy

MVP = Phase 2 + Phase 3 (US1): luồng lõi bền với tab đóng + schema sẵn cho crash-safe.
Sau đó US2 (harness chất lượng) là rẻ và chặn regression sớm. US5 làm theo 3 chuỗi độc lập
(crash-safe → 3 giờ → model/quota) — mỗi chuỗi ship được riêng, checkpoint bằng kịch bản
quickstart tương ứng. Mỗi lần dừng giữa chừng vẫn có increment kiểm chứng được.

**Tổng**: 26 tasks — US1: 2, US2: 2, US3: 1, US4: 1, US5: 14, Foundational: 3, Polish: 3.
