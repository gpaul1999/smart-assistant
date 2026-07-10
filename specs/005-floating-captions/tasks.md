# Tasks: Phụ đề ghim nổi (Document Picture-in-Picture)

**Input**: `specs/005-floating-captions/spec.md` · **Status**: DONE (2026-07-10)

Feature nhỏ, chạm đúng 1 surface (cửa sổ phụ đề live) — không cần plan.md riêng;
mọi thay đổi nằm trong `extension/live/*` + 1 dòng metadata ở background.

## Phase 1: UI + hành vi ghim nổi

- [x] T501 Nút `📌 Ghim nổi` trong `.head-actions` của `extension/live/live.html` + style
      `.pin`/`.pin.active` trong `extension/live/live.css`
- [x] T502 [FR-045] `togglePin()` trong `extension/live/live.js`:
      `documentPictureInPicture.requestWindow({width:420,height:320})`; nạp lại
      `live/live.css` qua `chrome.runtime.getURL`; **DI CHUYỂN** `#feed` + answer-card vào
      PiP (một nguồn render duy nhất, không nhân bản listener); `pagehide` trả phần tử về
      trước `footer`, reset nút — phiên ghi không gián đoạn
- [x] T503 [FR-046] Thiếu API `documentPictureInPicture` → notice "cần Chrome 116+",
      không crash; lỗi `requestWindow` (user gesture, PiP khác đang mở) → notice kèm message

## Phase 2: Gợi ý đúng ngữ cảnh

- [x] T504 [FR-047] `background.js` lưu `mode` vào `chrome.storage.session.recording`;
      `live.js` init: `mode !== 'tab'` và có API → notice gợi ý ghim nổi (một lần mỗi phiên,
      đúng tình huống user rời Chrome sang app họp desktop)

## Phase 3: Kiểm thử (Constitution IV)

- [x] T505 [SC-024] E2E `ghim nổi (005)` trong `tests/e2e/extension.spec.js`: nút hiện;
      click → hoặc `__smaPipOpen` true (PiP mở thật, `#feed` rời document chính) hoặc
      notice rõ ràng; bỏ ghim → `#feed` quay về cửa sổ thường. Chromium test mở PiP thật.
- [x] T506 Gate: 82 unit + 21 E2E xanh (2026-07-10)

## Ngoài phạm vi (ghi nhận roadmap)

- Overlay native đè lên app desktop kiểu Discord (click-through, không phải cửa sổ):
  cần companion app (Tauri/Electron) + Native Messaging — cân nhắc sau khi có tín hiệu cầu.
