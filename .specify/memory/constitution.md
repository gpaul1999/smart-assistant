<!--
Sync Impact Report
- Version change: (template) → 1.0.0 (ratification ban đầu)
- Modified principles: n/a (khởi tạo từ template, 6 nguyên tắc do chủ dự án cung cấp)
- Added sections: Core Principles (I–VI), Ràng buộc công nghệ & bảo mật, Quy trình phát triển
  & quality gates, Governance
- Removed sections: none
- Templates requiring updates:
  ✅ .specify/templates/plan-template.md (Constitution Check đọc trực tiếp file này — tương thích)
  ✅ .specify/templates/spec-template.md (không có ràng buộc trái với nguyên tắc)
  ✅ .specify/templates/tasks-template.md (phân loại task test-first tương thích Nguyên tắc IV)
- Follow-up TODOs: none
-->

# Smart Meeting Assistant (smart-assistant) Constitution

## Core Principles

### I. Local-First Tuyệt Đối (NON-NEGOTIABLE)

Audio, transcript, bản dịch, tóm tắt và mọi metadata cuộc họp KHÔNG BAO GIỜ rời máy người
dùng. Mọi xử lý (phiên âm, dịch, tóm tắt) PHẢI chạy on-device; mọi lưu trữ PHẢI nằm trong
trình duyệt (IndexedDB/Cache API). Network duy nhất được phép: tải trọng số model (Whisper
từ HuggingFace) một lần, cache lại, và chỉ chứa dữ liệu model — không kèm bất kỳ dữ liệu
người dùng nào. Code review PHẢI từ chối mọi thay đổi thêm network call mang dữ liệu người
dùng, kể cả analytics/telemetry.

**Lý do**: Đây là cam kết bảo mật định vị sản phẩm và là lời hứa với khách hàng trả tiền;
vi phạm một lần là phá vỡ toàn bộ giá trị thương hiệu.

### II. Simplicity First

ES module thuần, load unpacked trực tiếp; KHÔNG thêm framework, bundler hay build step khi
chưa có nhu cầu được chứng minh (ngoại lệ hiện có: script `npm run vendor` copy thư viện đã
đóng gói sẵn). Mỗi dependency mới PHẢI được biện minh trong DEVLOG. Ưu tiên API nền tảng
(Web Audio, MediaRecorder, Chrome built-in AI) trước thư viện bên thứ ba.

**Lý do**: Codebase nhỏ, ít tầng gián tiếp → dễ audit tính local-first (Nguyên tắc I), dễ
onboard, ít rủi ro supply-chain.

### III. Lib Environment-Agnostic

Mọi logic tái sử dụng PHẢI nằm trong `extension/lib/*` dưới dạng ES module thuần, không
tham chiếu `chrome.*` hay DOM trực tiếp; phụ thuộc môi trường (URL vendor, storage, message
bus) PHẢI được tiêm qua tham số. Điều này bảo đảm mọi lib chạy được trong Node để unit test.

**Lý do**: Extension khó test end-to-end với audio thật; tách lib thuần là cách duy nhất giữ
được vòng lặp test nhanh và tin cậy.

### IV. Test Đi Kèm Mọi Tính Năng

Tính năng mới PHẢI có unit test (`node --test`, fake-indexeddb cho DB) cho logic trong lib;
thay đổi chạm UI hoặc luồng extension PHẢI có E2E Playwright load extension thật vào
Chromium, với screenshot làm bằng chứng. Bug được sửa PHẢI kèm test tái hiện. Toàn bộ test
PHẢI xanh trước khi push.

**Lý do**: Ba bug đầu đời của dự án (regex Unicode, Summarizer treo, CSS đè `hidden`) đều
do test bắt được — kỷ luật này đã tự chứng minh.

### V. Một Pipeline Chung Cho Mọi Persona

Chức năng KHÔNG rẽ nhánh theo đối tượng khách hàng: không "chế độ phỏng vấn" / "chế độ họp"
riêng. Mọi phiên ghi đi qua đúng một luồng (capture → phiên âm live → dịch → lưu → tóm tắt);
persona chỉ khác ở cách tiêu thụ kết quả (phụ đề live vs tóm tắt sau). Đề xuất tính năng
tạo nhánh theo persona PHẢI bị từ chối hoặc tái thiết kế thành cấu hình của pipeline chung.

**Lý do**: Quyết định trực tiếp của chủ dự án (2026-07-05); một pipeline = một bề mặt test,
một bề mặt tối ưu hiệu năng, không phân mảnh trải nghiệm.

### VI. Hiệu Năng Cảm Nhận Được, Degrade Mượt

Phụ đề tạm (interim) PHẢI xuất hiện ≤2s sau lời nói trên máy hiện đại với model mặc định
(Whisper Tiny). Khi tài nguyên không đủ (máy yếu, model lớn hơn), hệ thống PHẢI degrade
mượt: partial là lossy (bỏ nhịp khi inference bận), câu chốt (final) KHÔNG BAO GIỜ bị mất,
và độ trễ không được tích lũy theo thời gian phiên. Thay đổi ảnh hưởng đường nóng audio
PHẢI nêu tác động độ trễ trong PR/DEVLOG.

**Lý do**: Use case phỏng vấn sống chết ở độ trễ phụ đề; use case họp dài sống chết ở việc
không mất nội dung — cả hai ràng buộc phải giữ đồng thời.

## Ràng Buộc Công Nghệ & Bảo Mật

- Nền tảng: Chrome Extension Manifest V3; capture qua `tabCapture` + `getUserMedia`.
- Phiên âm: Whisper qua transformers.js/WASM, vendor vào `extension/vendor/` (MV3 cấm remote
  code). Dịch/tóm tắt: Chrome Translator/Summarizer API (Gemini Nano on-device) với fallback
  thuần JS — KHÔNG cloud API.
- Quyền extension tối thiểu: chỉ xin permission thực sự dùng (`tabCapture`, `offscreen`,
  `storage`, `activeTab`); thêm permission mới cần biện minh trong DEVLOG.
- Xóa dữ liệu là xóa thật: thao tác xóa của người dùng PHẢI xóa cả record lẫn blob audio.

## Quy Trình Phát Triển & Quality Gates

- Làm việc theo Spec-Driven Development khi thêm tính năng có phạm vi đáng kể:
  `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → implement; artifact nằm trong
  `specs/<NNN-ten-feature>/`.
- Quyết định kiến trúc và bug đáng nhớ ghi vào `DEVLOG.md`.
- Quality gate trước khi push: `npm test` xanh + `npm run test:e2e` xanh.
- Skill/toolkit cho AI agent tuân theo routing tại CLAUDE.md (bộ base-project-require-skills);
  chỉ dùng toolkit đã cài.

## Governance

Constitution này thay thế mọi thói quen ngầm định khi có xung đột. Sửa đổi PHẢI: (1) cập
nhật file này kèm Sync Impact Report, (2) tăng version theo semver — MAJOR khi bỏ/định nghĩa
lại nguyên tắc, MINOR khi thêm nguyên tắc/mục mới, PATCH khi làm rõ câu chữ, (3) được chủ
dự án chấp thuận. Mọi PR/review PHẢI kiểm tra tuân thủ, đặc biệt Nguyên tắc I (local-first)
và V (một pipeline). Hướng dẫn runtime cho agent nằm ở `CLAUDE.md`; khi hai file lệch nhau,
constitution thắng và CLAUDE.md phải được đồng bộ lại.

**Version**: 1.0.0 | **Ratified**: 2026-07-05 | **Last Amended**: 2026-07-05
