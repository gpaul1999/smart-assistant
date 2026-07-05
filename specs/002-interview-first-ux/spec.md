# Feature Specification: Interview-first UX — đưa sản phẩm đến tay người dùng thật

**Feature Branch**: `002-interview-first-ux`

**Created**: 2026-07-05

**Status**: Draft

**Input**: Kết quả phản biện `docs/office-hours-2026-07-05.md` + 4 quyết định đã chốt của
chủ dự án (D1–D4). Phạm vi CHỦ ĐÍCH giới hạn: chỉ những gì cần để một người đi phỏng vấn
thật cài được, hiểu được, và có khoảnh khắc "aha" đầu tiên trong ≤3 phút — vì chưa có bằng
chứng cầu (D1), mọi thứ khác chờ tín hiệu từ người dùng thật.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cài đặt đến "aha" đầu tiên trong 3 phút (Priority: P1)

Một người sắp phỏng vấn bằng ngoại ngữ tìm thấy extension trên Chrome Web Store, bấm cài.
Một trang chào mở ra tự động với đúng 3 bước: (1) cấp quyền micro, (2) chọn ngôn ngữ muốn
dịch sang, (3) bấm "Thử ngay" trên một video hội thoại mẫu nhúng sẵn — thấy phụ đề + bản
dịch chạy trực tiếp ngay trên video đó. Trong lúc onboarding, bộ nhận dạng được chuẩn bị
nền (tải model + benchmark máy) với thanh tiến độ, và hệ thống tự chọn cấu hình nhận dạng
tốt nhất mà máy họ giữ được độ trễ ≤2s — người dùng không bao giờ phải biết "model" là gì.

**Why this priority**: Time-to-first-aha là chỉ số sống còn của sản phẩm freemium; mọi
tính năng phía sau vô nghĩa nếu 3 phút đầu thất bại. Phục vụ trực tiếp D1 (đưa sản phẩm
đến tay người thử) và P2/U2/U3 của bản phản biện.

**Independent Test**: Cài từ file đóng gói trên máy sạch (xóa hết trạng thái), bấm giờ từ
lúc cài đến lúc thấy phụ đề dịch đúng trên video mẫu: ≤3 phút kể cả tải model trên mạng
thường.

**Acceptance Scenarios**:

1. **Given** vừa cài extension, **When** cài xong, **Then** trang onboarding tự mở, có
   đúng 3 bước, tiếng Việt hoặc tiếng Anh theo ngôn ngữ trình duyệt.
2. **Given** đang ở onboarding, **When** người dùng đi qua các bước, **Then** model được
   tải nền + benchmark chạy, có thanh tiến độ, và cấu hình nhận dạng được tự chọn theo máy.
3. **Given** hoàn thành bước 3 (video mẫu), **When** phụ đề + bản dịch hiện trên video,
   **Then** onboarding kết thúc bằng chỉ dẫn "vào cuộc họp thật, bấm icon để bắt đầu".
4. **Given** người dùng bỏ qua onboarding giữa chừng, **When** mở popup lần đầu, **Then**
   popup nhắc quay lại hoàn tất (không chặn dùng).

---

### User Story 2 - Phụ đề overlay ngay trong tab họp (Priority: P1)

Trong buổi phỏng vấn trên Google Meet/Zoom web/Teams web, phụ đề song ngữ hiển thị **ngay
trong tab họp** như phụ đề phim: nổi trên nội dung, kéo-thả được vị trí, chỉnh được cỡ chữ,
và bật/tắt nhanh. Người dùng không phải rời mắt khỏi người phỏng vấn. Cửa sổ phụ đề riêng
(hiện có) trở thành fallback khi trang không cho phép overlay.

**Why this priority**: Quyết định D4; sửa trực tiếp điểm ma sát lớn nhất của persona
phỏng vấn (P3 trong bản phản biện).

**Independent Test**: Ghi trên một trang họp giả lập; overlay xuất hiện trong tab, kéo-thả
và đổi cỡ chữ được; đóng overlay → mở lại từ popup; trang không hỗ trợ → tự fallback cửa sổ
riêng kèm thông báo.

**Acceptance Scenarios**:

1. **Given** bắt đầu ghi trên tab họp, **When** phụ đề đầu tiên có, **Then** overlay hiện
   trong tab với phụ đề tạm/chốt + bản dịch, phân biệt được như cửa sổ riêng hiện tại.
2. **Given** overlay đang hiện, **When** kéo overlay hoặc chỉnh cỡ chữ, **Then** vị trí và
   cỡ chữ được nhớ cho các phiên sau.
3. **Given** trang chặn script chèn, **When** bắt đầu ghi, **Then** hệ thống tự mở cửa sổ
   phụ đề riêng và nói rõ lý do.
4. **Given** overlay đang hiện, **When** người dùng tắt overlay, **Then** phiên ghi vẫn
   tiếp tục bình thường (overlay chỉ là nơi hiển thị — một pipeline, Constitution V).

---

### User Story 3 - Ra Chrome Web Store beta + niềm tin & pháp lý tối thiểu (Priority: P1)

Sản phẩm được đóng gói và đăng Chrome Web Store (beta unlisted trước, public sau), với
privacy policy nêu đúng sự thật local-first, và lần chạy đầu hiển thị lưu ý ngắn về luật
ghi âm (một số nơi cần sự đồng ý của cả hai bên) kèm lựa chọn "chỉ phụ đề, không lưu ghi
âm" khi bắt đầu phiên.

**Why this priority**: Không có store listing = không có người dùng thật = không bao giờ
có bằng chứng cầu (D1, P5/P6 trong bản phản biện).

**Independent Test**: Gói `extension/` thành zip qua lệnh npm, tải lên store dashboard
không bị từ chối vì thiếu privacy policy/permission justification; first-run notice hiện
đúng một lần; bắt đầu ghi có lựa chọn "chỉ phụ đề".

**Acceptance Scenarios**:

1. **Given** repo ở trạng thái sạch, **When** chạy lệnh đóng gói, **Then** ra file zip
   đúng cấu trúc store yêu cầu (không kèm file thừa), version khớp manifest.
2. **Given** lần chạy đầu sau cài, **When** mở popup/onboarding, **Then** thấy lưu ý ghi
   âm 2 câu + link privacy; chỉ hiện một lần.
3. **Given** bắt đầu phiên, **When** chọn "chỉ phụ đề, không lưu ghi âm", **Then** phụ đề
   + dịch chạy bình thường nhưng không lưu audio và không lưu transcript sau khi đóng.

---

### User Story 4 - Nhắc ghi khi vào cuộc họp (Priority: P2)

Người dùng mở tab Google Meet/Zoom/Teams mà quên bấm ghi: icon extension đổi badge gợi ý
và (tùy chọn, mặc định bật) một notification nhẹ "Bắt đầu ghi cuộc họp này?" — bấm là ghi.
Không bao giờ tự động ghi.

**Why this priority**: "Quên bấm ghi = mất cả buổi" là lỗi không cứu được (U5); nhưng xếp
sau vì cần US1–US3 có mặt trước đã.

**Independent Test**: Mở trang thuộc domain họp → badge đổi + notification hiện; bấm
notification → phiên ghi bắt đầu; tắt tùy chọn → không notification nữa; domain khác →
không có gì.

**Acceptance Scenarios**:

1. **Given** tùy chọn nhắc đang bật, **When** mở tab meet.google.com / zoom.us / teams,
   **Then** badge gợi ý + notification một lần cho tab đó; bấm vào là bắt đầu ghi tab đó.
2. **Given** tùy chọn tắt, **When** mở tab họp, **Then** không notification (badge vẫn đổi).
3. **Given** đang ghi phiên khác, **When** mở tab họp mới, **Then** không nhắc (FR-005).

---

### User Story 5 - Nền tảng freemium: license Pro (Priority: P3)

Người dùng mua license Pro (thanh toán ngoài, ví dụ trang bán license) nhận một mã key;
dán key vào phần cài đặt của extension để mở các tính năng Pro (đợt đầu: re-transcribe
chất lượng cao và export nâng cao). Kiểm tra key không bao giờ gửi kèm bất kỳ dữ liệu cuộc
họp nào; không có key, mọi tính năng free vẫn không giới hạn.

**Why this priority**: D3 đã chốt mô hình, nhưng thu tiền chỉ có nghĩa khi đã có người
dùng thật (D1) — xếp cuối, xây phần "khung cắm key" trước, cổng thanh toán chọn sau.

**Independent Test**: Nhập key hợp lệ (định dạng offline-verifiable) → tính năng Pro mở,
trạng thái hiện trong popup; key sai → thông báo rõ; không key → mọi tính năng free chạy
đủ; giám sát network trong lúc nhập key: không request nào chứa dữ liệu họp.

**Acceptance Scenarios**:

1. **Given** không có key, **When** dùng sản phẩm, **Then** ghi/phụ đề/dịch/tóm tắt không
   giới hạn (free hào phóng — D3).
2. **Given** key hợp lệ được nhập, **When** xác thực xong, **Then** nút re-transcribe HQ và
   export nâng cao mở khóa; trạng thái Pro hiển thị.
3. **Given** đang xác thực key, **When** giám sát network, **Then** chỉ có key + định danh
   license được gửi tới dịch vụ license — không metadata cuộc họp (Constitution I).

### Edge Cases

- Onboarding mở lại lần hai (user tự mở) → chạy lại được, không hỏng trạng thái.
- Máy quá yếu: benchmark không giữ nổi ≤2s với model nhỏ nhất → nói thẳng kỳ vọng ("máy
  bạn phụ đề sẽ trễ ~Xs") thay vì im lặng.
- Overlay đè lên control của Meet → phải kéo đi được; nhớ vị trí theo domain.
- Update extension giữa phiên ghi → phiên được chốt an toàn nhờ crash-safe (spec 001 FR-016).
- Người dùng offline khi onboarding → bước video mẫu vẫn chạy nếu model đã có; chưa có
  model → thông báo cần mạng một lần.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-021**: Extension MUST tự mở trang onboarding sau khi cài, gồm đúng 3 bước (mic →
  ngôn ngữ dịch → thử trên video mẫu nhúng sẵn), hoàn tất được trong ≤3 phút kể cả chuẩn bị
  model (SC-009).
- **FR-022**: Hệ thống MUST benchmark máy trong onboarding (hoặc lần ghi đầu) và tự chọn
  cấu hình nhận dạng tốt nhất giữ được phụ đề tạm ≤2s; người dùng không phải chọn model;
  vẫn override được trong phần Nâng cao.
- **FR-023**: Hệ thống MUST dùng tăng tốc phần cứng (WebGPU) cho nhận dạng khi máy hỗ trợ,
  fallback WASM khi không — không đổi hành vi chức năng.
- **FR-024**: Phụ đề live MUST hiển thị overlay trong tab họp (mặc định): phụ đề tạm/chốt +
  bản dịch, kéo-thả vị trí, chỉnh cỡ chữ, bật/tắt; vị trí/cỡ chữ được nhớ. Trang không chèn
  được overlay → tự fallback cửa sổ riêng kèm lý do. Overlay chỉ là nơi hiển thị — không
  rẽ nhánh pipeline (Constitution V).
- **FR-025**: UI MUST có i18n tối thiểu vi + en, theo ngôn ngữ trình duyệt.
- **FR-026**: Repo MUST có lệnh đóng gói store-ready (zip đúng nội dung, đúng version) và
  tài liệu privacy policy phản ánh đúng kiến trúc local-first.
- **FR-027**: Lần chạy đầu MUST hiển thị lưu ý pháp lý ghi âm ngắn (một lần) và mỗi lần
  bắt đầu phiên MUST có lựa chọn "chỉ phụ đề, không lưu" (không lưu audio + không giữ
  transcript sau phiên).
- **FR-028**: Khi mở tab thuộc domain họp phổ biến, extension MUST gợi ý bắt đầu ghi
  (badge + notification tùy chọn, mặc định bật, một lần mỗi tab); MUST KHÔNG bao giờ tự
  động ghi.
- **FR-029**: Extension MUST có khung license Pro: nhập key, xác thực offline-verifiable
  (chữ ký), trạng thái Pro trong popup; xác thực MUST không gửi bất kỳ dữ liệu cuộc họp
  nào. Tính năng free MUST không giới hạn khi không có key (D3).
- **FR-030**: Panel "Dữ liệu của bạn" trong viewer MUST hiển thị: tổng dung lượng, nơi lưu
  (trên máy này), nút xóa toàn bộ, link mã nguồn/privacy.

### Key Entities

- **OnboardingState** (chrome.storage.local): bước đã hoàn thành, đã benchmark chưa, kết
  quả benchmark (model được chọn, thiết bị WebGPU/WASM), đã thấy lưu ý pháp lý chưa.
- **OverlayPrefs** (chrome.storage.local, theo domain): vị trí, cỡ chữ, bật/tắt.
- **License** (chrome.storage.local): key, trạng thái, hạn (nếu có) — không liên kết gì
  với dữ liệu cuộc họp.
- **Phiên "chỉ phụ đề"**: cờ trên phiên ghi — không tạo bản ghi âm, transcript chỉ giữ
  trong phiên (không persist sau khi đóng).

## Success Criteria *(mandatory)*

- **SC-009**: Người mới trên máy sạch: cài → thấy phụ đề dịch đúng trên video mẫu ≤3 phút
  (mạng phổ thông).
- **SC-010**: Trong phiên ghi trên trang họp hỗ trợ, ≥95% thời gian phụ đề hiển thị bằng
  overlay trong tab (không phải cửa sổ rời), đo trên phiên thử.
- **SC-011**: Máy có WebGPU: phụ đề tạm ≤2s với cấu hình nhận dạng cao hơn ít nhất một bậc
  so với WASM (đo cùng máy).
- **SC-012**: Gói zip từ lệnh đóng gói được store dashboard chấp nhận không lỗi cấu trúc;
  beta unlisted sống trong 30 ngày kể từ khi spec này được duyệt (assignment #3).
- **SC-013**: Chế độ "chỉ phụ đề": sau khi đóng phiên, không tồn tại audio lẫn transcript
  của phiên đó trong storage (kiểm chứng bằng test đọc IndexedDB).

## Assumptions

- Danh sách domain họp đợt đầu: meet.google.com, zoom.us (web client), teams.microsoft.com,
  teams.live.com — mở rộng sau theo phản hồi.
- Cổng thanh toán/nhà cung cấp license chọn sau (ExtensionPay/LemonSqueezy/Gumroad đều
  offline-verifiable được); spec này chỉ xây khung nhập + xác thực key.
- Video mẫu onboarding là file tĩnh đóng gói kèm extension (không phụ thuộc mạng).
- Đánh giá buổi phỏng vấn bằng AI (Prompt API) là tính năng Pro tương lai — NGOÀI phạm vi
  002, chờ bằng chứng cầu từ assignments (D1).
