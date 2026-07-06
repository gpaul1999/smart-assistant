# Research — 002-interview-first-ux (Phase 0)

## R1. Onboarding "aha" không cần asset (FR-021)

**Decision**: `chrome.runtime.onInstalled` (reason `install`) → mở `onboarding/onboarding.html`.
3 bước: (1) mic + notice pháp lý ngắn, (2) chọn ngôn ngữ dịch, (3) **"nói thử một câu"** —
capture mic tại chỗ, phiên âm + dịch ngay trên trang (dùng Transcriber/translator như
offscreen). Model tải + benchmark chạy nền từ bước 1 với progress bar.
**Rationale**: không có video hội thoại license-sạch để đóng gói; giọng của chính user là
demo cá nhân nhất; gói không phình. **Alternatives**: video bundle (nặng, licensing);
audio TTS bundle (chất lượng phiên âm demo kém → phản tác dụng).

## R2. Benchmark chọn model (FR-022)

**Decision**: đo RTF (real-time factor) = thời_gian_infer / thời_lượng_audio trên 5s PCM
tổng hợp, với tiny (và base nếu tiny nhanh); chạy trong offscreen lúc onboarding. Logic chọn
tách thuần vào `lib/model-policy.js`: `pickModels({device, rtfTiny, rtfBase})` →
`{liveModel, accurateModel}` — live cần RTF ≤ 0.5 (chừa nửa thời gian cho decode+dịch+UI).
Lưu vào `settings.bench = {device, rtfTiny, rtfBase, pickedAt}`; user override được ở Nâng cao.
**Alternatives**: đoán theo hardwareConcurrency/RAM (không phản ánh WASM/WebGPU thật).

## R3. WebGPU (FR-023)

**Decision**: feature-detect `navigator.gpu?.requestAdapter()` trong offscreen →
`Transcriber` nhận `device: 'webgpu'|'wasm'`; webgpu dùng `dtype: {encoder_model:'fp16',
decoder_model_merged:'q4'}` (khuyến nghị transformers.js v3), wasm giữ `q8`. Lỗi
init webgpu → tự hạ về wasm + ghi vào bench. **Alternatives**: chỉ WASM (bỏ SC-011).

## R4. Overlay phụ đề trong tab họp (FR-024)

**Decision**: KHÔNG khai báo content_scripts tĩnh (khỏi xin host permission rộng).
Khi bắt đầu ghi: background `chrome.scripting.executeScript({target:{tabId}, files:
['content/overlay.js']})` — hợp lệ nhờ **activeTab** (user vừa bấm icon) + permission
`scripting`. Overlay = shadow DOM (không đụng CSS trang), kéo-thả, nút A±/đóng; prefs theo
domain trong `chrome.storage.local.overlayPrefs`. **Message routing**: content script KHÔNG
nhận `chrome.runtime.sendMessage` broadcast → background relay `live-partial`/`live-segment`
qua `chrome.tabs.sendMessage(recordingTabId, msg)`. Inject/relay lỗi (trang chặn) → fallback
mở cửa sổ live như cũ + notice. **Alternatives**: content_scripts tĩnh trên domain họp
(cần host permission → store review khó hơn, thiếu linh hoạt trang lạ).

## R5. i18n (FR-025)

**Decision**: `_locales/{vi,en}/messages.json`, `default_locale: "vi"`; trang HTML dùng
helper `lib/i18n.js` quét `[data-i18n]`/`[data-i18n-attr]` gọi `chrome.i18n.getMessage`
(helper nhận hàm getMessage qua tham số → test được bằng Node). `buildMarkdown`/lib giữ
nhãn qua tham số mặc định tiếng Việt (env-agnostic, không đụng chrome.*).

## R6. Nhắc ghi khi vào domain họp (FR-028)

**Decision**: permission `tabs` + `notifications`; `tabs.onUpdated` khớp
meet.google.com|*.zoom.us|teams.microsoft.com|teams.live.com → `action.setBadgeText({tabId,
text:'●'})` + notification một-lần-mỗi-tab (map tabId đã nhắc, TTL đến khi đóng tab).
Click notification → focus tab + `chrome.action.openPopup()` best-effort (không phải mọi
bản Chrome cho phép ngoài gesture trên toolbar) — KHÔNG hứa auto-ghi vì tabCapture đòi
invoke từ action trên tab. Setting `meetingNudge` (default true). **Alternatives**:
auto-record (cấm theo spec); content script banner (cần host permission).

## R7. Chế độ "chỉ phụ đề, không lưu" (FR-027)

**Decision**: checkbox ở popup → `offscreen-start` nhận `ephemeral: true`: bỏ MediaRecorder
+ chunk persist, KHÔNG tạo record `meetings`; segments chỉ broadcast (overlay/cửa sổ);
dừng → không có gì trong thư viện. First-run notice: đoạn 2 câu trong onboarding bước 1 +
lưu cờ `noticeSeen`. **Alternatives**: ghi rồi xóa khi dừng (dữ liệu vẫn chạm đĩa — kém
trung thực hơn với lời hứa).

## R8. License Pro Ed25519 offline (FR-029)

**Decision**: key format `SMA1.<base64url(payload JSON)>.<base64url(signature)>`;
payload `{plan:'pro', sub, iat, exp?}`; verify bằng WebCrypto Ed25519 với public key nhúng
(`lib/license.js` — WebCrypto có cả ở Node ≥20 → unit test sinh keypair, ký, verify, expiry,
tamper). Trạng thái lưu `chrome.storage.local.license`. V1 gate: model Whisper Small
(re-transcribe HQ) chỉ Pro. KHÔNG network — bán key qua kênh ngoài (LemonSqueezy/Gumroad
ký bằng private key khi checkout, chọn sau). **Alternatives**: HMAC (secret lộ trong
extension → forge được), gọi API verify (vi phạm local-first, chết offline).

## R9. Đóng gói store (FR-026)

**Decision**: `scripts/pack.mjs`: chạy `npm run vendor` (đảm bảo vendor mới) → zip thư mục
`extension/` bằng lệnh `zip` hệ thống → `dist/smart-meeting-assistant-<version>.zip`
(version đọc từ manifest). Privacy policy: `docs/privacy-policy.md` (vi+en ngắn) — nội dung
đúng kiến trúc: không thu thập, không gửi, dữ liệu trong trình duyệt, network duy nhất là
tải model. **Alternatives**: archiver npm (thêm dep không cần).

## R10. Panel "Dữ liệu của bạn" (FR-030)

**Decision**: section trong viewer: usage/quota (tái dùng storage-policy), số cuộc họp,
nút "Xóa toàn bộ dữ liệu" (confirm 2 lớp → xóa 3 store + settings giữ lại), link privacy
policy + mã nguồn. **Alternatives**: trang riêng (thừa).
