# Implementation Plan: Interview-first UX

**Branch**: `claude/meeting-recorder-local-jsifj3` (spec dir: `002-interview-first-ux`) | **Date**: 2026-07-06 | **Spec**: [spec.md](spec.md)

## Summary

Đưa sản phẩm đến tay người thử đầu tiên trong ≤3 phút: onboarding tự mở sau cài (mic →
ngôn ngữ → thử ngay bằng giọng thật), benchmark máy tự chọn model + WebGPU, overlay phụ đề
trong tab họp (content script + relay qua background), i18n vi/en, đóng gói store-ready +
privacy policy, first-run notice + chế độ chỉ-phụ-đề-không-lưu, nhắc ghi khi vào domain
họp, khung license Pro Ed25519 offline-verify, panel "Dữ liệu của bạn".

## Technical Context

**Language/Version**: JavaScript ES2022, ES modules thuần (Constitution II)

**Primary Dependencies**: như spec 001 + WebGPU (transformers.js `device:'webgpu'`),
`chrome.scripting`/`activeTab` (overlay), `chrome.i18n`, `chrome.notifications`,
WebCrypto Ed25519 (license — có trong Chrome hiện đại VÀ Node ≥20 → lib test được)

**Storage**: chrome.storage.local (settings mở rộng, onboarding, overlayPrefs, license);
IndexedDB không đổi schema

**Testing**: node --test (license, model-policy); Playwright E2E (onboarding, overlay
inject trên trang test, viewer panel, popup states)

**Target Platform**: Chrome desktop ≥138; manifest `default_locale: vi`

**Project Type**: Chrome Extension MV3

**Performance Goals**: SC-009 cài→aha ≤3'; SC-011 WebGPU nâng ≥1 bậc model cùng độ trễ

**Constraints**: local-first tuyệt đối (license verify offline, KHÔNG gọi server trong v1);
overlay không rẽ nhánh pipeline (chỉ là consumer mới của live-partial/segment)

**Scale/Scope**: ~10 file mới (onboarding, content overlay, _locales, license, model-policy,
pack script, privacy policy) + sửa manifest/popup/background/offscreen/viewer

## Constitution Check

| Nguyên tắc | Đánh giá |
|---|---|
| I. Local-first | ✅ Không network mới; license verify bằng chữ ký offline; notice pháp lý là văn bản tĩnh |
| II. Simplicity | ✅ 0 dependency mới (Ed25519 = WebCrypto; zip = script hệ thống); i18n = chrome.i18n chuẩn |
| III. Lib env-agnostic | ✅ `lib/license.js` (WebCrypto chung Node/Chrome), `lib/model-policy.js` thuần |
| IV. Test đi kèm | ✅ unit cho license/model-policy; E2E onboarding/overlay/panel |
| V. Một pipeline | ✅ Overlay/chế độ ephemeral là config + consumer của pipeline hiện có |
| VI. Hiệu năng | ✅ Benchmark chọn model giữ ≤2s; overlay render DOM nhẹ |

**Gate: PASS.** (Re-check sau Phase 1: PASS — không phát sinh vi phạm.)

**Amendment spec (ghi nhận)**: FR-021 bước 3 đổi từ "video mẫu nhúng sẵn" → **"thử ngay
bằng chính giọng bạn"** (nói một câu → thấy phụ đề + dịch). Lý do: không có nguồn video
hội thoại license-sạch để đóng gói; mic-test cho khoảnh khắc aha cá nhân hơn, gói nhẹ hơn,
và mic vừa được cấp ở bước 1 (research R1). FR-028 "bấm là ghi" → "bấm → focus tab họp +
mở popup (best-effort)" vì tabCapture yêu cầu invoke từ action trên tab (research R6).

## Project Structure

```text
extension/
├── manifest.json            # +default_locale, +permissions: scripting, tabs, notifications
├── _locales/{vi,en}/messages.json   # MỚI (FR-025)
├── onboarding/              # MỚI (FR-021/022/027): 3 bước + benchmark + notice pháp lý
├── content/overlay.js       # MỚI (FR-024): shadow-DOM caption overlay, kéo-thả, nhớ prefs
├── lib/
│   ├── license.js           # MỚI (FR-029): verify Ed25519 offline, parse key
│   ├── model-policy.js      # MỚI (FR-022/023): chọn model từ kết quả benchmark + WebGPU
│   └── i18n.js              # MỚI: helper dịch data-i18n cho trang HTML
├── background.js            # +relay caption→content script, +nudge domain họp, +mở onboarding khi cài
├── offscreen/offscreen.js   # +benchmark đo RTF, +device webgpu, +ephemeral session
├── popup/                   # +chế độ phụ đề (overlay/cửa sổ/tắt), +chỉ-phụ-đề-không-lưu, +Pro status
└── viewer/                  # +panel "Dữ liệu của bạn" (FR-030), +gate Pro cho whisper-small

scripts/pack.mjs             # MỚI (FR-026): zip store-ready
docs/privacy-policy.md       # MỚI (FR-026)
tests/unit/{license,model-policy}.test.js
tests/e2e/ (mở rộng)
```

**Structure Decision**: giữ một extension; mọi logic mới testable nằm ở `extension/lib/*`.

## Complexity Tracking

Không vi phạm constitution. Rủi ro kỹ thuật chính: WebGPU trong offscreen document (R3 có
fallback WASM tự động) và openPopup từ notification (R6 — best-effort, không phải đường chính).
