# Tasks: Interview-first UX (002)

**Input**: plan.md, research.md (R1–R10), data-model.md, contracts/messages.md

## Phase 2: Foundational

- [x] T101 Manifest: `default_locale: vi`, permissions +`scripting`, +`tabs`, +`notifications`;
      version 0.3.0 (`extension/manifest.json`)
- [x] T102 [P] i18n: `extension/_locales/{vi,en}/messages.json` (chuỗi UI chính) +
      `extension/lib/i18n.js` (helper data-i18n, nhận getMessage qua tham số) + unit test
      `tests/unit/i18n.test.js` (FR-025)
- [x] T103 [P] `extension/lib/model-policy.js`: `pickModels({device, rtfTiny, rtfBase})` +
      unit test `tests/unit/model-policy.test.js` (FR-022)

## Phase 3: US1 — Onboarding 3 phút (P1)

- [x] T104 [US1] `extension/onboarding/` (html/js/css): 3 bước (mic+notice → ngôn ngữ →
      nói thử), progress model, lưu `onboarding` state (FR-021/027, R1)
- [x] T105 [US1] Offscreen: handler `offscreen-benchmark` (detect WebGPU + đo RTF, lưu
      settings.bench + models qua model-policy) và `onboarding-transcribe` (R2)
- [x] T106 [US1] Transcriber nhận `device` (webgpu/wasm, dtype tương ứng), fallback wasm
      khi webgpu lỗi (`extension/lib/transcriber.js`) (FR-023, R3)
- [x] T107 [US1] Background: `onInstalled(install)` → mở onboarding; popup nhắc khi
      onboarding dở (FR-021)
- [x] T108 [US1] E2E: onboarding render 3 bước, chuyển bước, lưu state

## Phase 4: US2 — Overlay phụ đề trong tab (P1)

- [x] T109 [US2] `extension/content/overlay.js`: shadow DOM, partial/final + dịch, kéo-thả,
      A±, nút dừng, prefs theo origin (FR-024, R4)
- [x] T110 [US2] Background: inject overlay khi start (activeTab + scripting), giữ
      `recordingTabId`, relay live-partial/segment/stopped qua tabs.sendMessage; lỗi →
      fallback cửa sổ live + `overlay-fallback` (R4)
- [x] T111 [US2] Popup: select chế độ phụ đề overlay/window/off (settings.captionMode)
- [x] T112 [US2] E2E: inject overlay vào trang test qua scripting, gửi caption giả →
      hiện đúng; prefs lưu

## Phase 5: US3 — Store-ready + ephemeral (P1)

- [x] T113 [US3] `scripts/pack.mjs` (+`npm run pack`): vendor → zip `dist/…-<version>.zip`
      (FR-026, R9)
- [x] T114 [P] [US3] `docs/privacy-policy.md` (vi+en) (FR-026)
- [x] T115 [US3] Chế độ "chỉ phụ đề, không lưu": checkbox popup → ephemeral qua
      offscreen-start (không recorder/chunk/record), recording-started mang cờ (FR-027, R7)
- [x] T116 [US3] E2E: phiên ephemeral không để lại record/chunk trong IndexedDB (SC-013,
      mức API)

## Phase 6: US4 — Nudge domain họp (P2)

- [x] T117 [US4] Background: tabs.onUpdated khớp domain họp → badge ● theo tab +
      notification một-lần-mỗi-tab; click → focus + openPopup best-effort; setting
      `meetingNudge` (FR-028, R6)

## Phase 7: US5 — License Pro (P3)

- [x] T118 [US5] `extension/lib/license.js`: parse/verify `SMA1.` Ed25519 (WebCrypto),
      check exp + unit test (sinh keypair, ký, verify, tamper, expiry) (FR-029, R8)
- [x] T119 [P] [US5] `scripts/make-license.mjs`: sinh keypair dev + ký key test
- [x] T120 [US5] Popup/viewer: ô nhập key + trạng thái Pro; gate Whisper Small (re-transcribe)
      theo Pro (FR-029/D3)

## Phase 8: FR-030 + Polish

- [x] T121 Panel "Dữ liệu của bạn" trong viewer: usage, số phiên, xóa toàn bộ (confirm),
      link privacy/source + E2E (FR-030, R10)
- [x] T122 Cập nhật README/DEVLOG; đồng bộ contracts nếu lệch
- [x] T123 Full gate: unit + E2E xanh; `npm run pack` ra zip; ghi kết quả vào quickstart.md

## Dependencies

T101 → tất cả; T102/T103 [P]; T104→T105→(T106 song song)→T107→T108; T109→T110→T111→T112;
T113/T114 [P]; T115→T116; T118→T119→T120; T121 độc lập sau T101.
MVP tối thiểu ship được: Phase 2 + Phase 3 (onboarding) + Phase 5 (store zip).

## Ghi chú implement (2026-07-06)

- T105: đổi thiết kế — benchmark + "nói thử" chạy trong trang onboarding thay vì RPC qua
  offscreen (xem contracts/messages.md); offscreen đọc `settings.bench`.
- T116: kiểm chứng tự động dừng ở mức UI (checkbox + luồng cờ ephemeral); hành vi
  không-ghi-đĩa end-to-end cần capture thật → kịch bản thủ công J trong quickstart.md.
