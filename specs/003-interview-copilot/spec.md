# Feature Specification: Copilot trả lời từ tài liệu (Docs-Grounded Answers — Pro)

**Feature Branch**: `003-interview-copilot`

**Created**: 2026-07-05 · **Revised**: 2026-07-05 (làm rõ ý định của chủ dự án)

**Status**: Draft

**Input**: Ý tưởng gốc "nghe câu hỏi → gợi ý trả lời từ tài liệu user cung cấp trước",
được chủ dự án làm rõ: *"tài liệu quá lớn và khó nhớ chính xác — user chỉ định tài liệu
trước, chúng ta đề xuất trả lời dựa trên tài liệu"*. Đây là **trợ lý trả lời có căn cứ**
cho người phải trả lời câu hỏi dựa trên kho tài liệu lớn của chính họ (họp khách hàng với
hợp đồng/spec dày, hỗ trợ kỹ thuật, bảo vệ luận án, và phỏng vấn). Quyết định **D5 tinh
chỉnh (2026-07-05)**: cho phép SINH câu trả lời đề xuất **khi và chỉ khi có căn cứ trích
dẫn từ tài liệu của user** ("grounded"); CẤM sinh nội dung không căn cứ; không có căn cứ
→ nói thẳng "không tìm thấy trong tài liệu". Nền tảng: Chrome Prompt API (Gemini Nano,
on-device) — Constitution I giữ nguyên.

## Amendment D6 (2026-07-06 — chủ dự án đổi scope tier)

- **FR-031 (sửa)**: kho tài liệu mở cho CẢ Free: dán text, **tổng kho ≤3.000 ký tự**
  (`lib/doc-limits.js`, hằng số một chỗ). Pro: **nhập file text-format**
  (txt/md/csv/tsv/json/html/xml/srt/vtt/log/yaml) **không giới hạn ký tự**; extract text
  chạy LOCAL (`lib/doc-import.js` — bóc thẻ HTML, bỏ timestamp phụ đề). PDF/DOCX: phase
  sau, vẫn local (pdf.js vendor / DecompressionStream).
- **FR-037 (sửa)**: thẻ trả lời live mở cho Free (giới hạn nằm ở tầng nhập kho);
  "Rà soát phỏng vấn" + Whisper Small vẫn là Pro.
- **Ghi chú markitdown**: là MCP tool Python phía DEV (đọc tài liệu khi phát triển) —
  không nhúng vào extension được và không được gửi tài liệu ra ngoài (Constitution I);
  sản phẩm dùng convert JS local cùng tinh thần.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Kho tài liệu tham chiếu (Priority: P1)

Trước buổi họp/phỏng vấn, người dùng nạp các tài liệu họ sẽ bị hỏi đến: hợp đồng, spec
sản phẩm, bảng giá, CV/JD, ghi chú chuẩn bị — có thể rất dài (hàng trăm trang, vượt xa
những gì nhớ nổi). Tài liệu được lưu và lập chỉ mục hoàn toàn trên máy, quản lý theo bộ
(ví dụ: "Khách hàng ACME", "Phỏng vấn công ty X"), chọn bộ nào dùng cho phiên nào.

**Why this priority**: Là đầu vào của toàn bộ Copilot; kho tài liệu riêng tư tự nó đã có
giá trị (không ai dám dán hợp đồng khách hàng vào chatbot cloud — ta thì local).

**Independent Test**: Nạp tài liệu tổng ≥500 trang chia nhiều file/mục; đóng mở trình
duyệt còn nguyên; tìm kiếm thủ công trong kho ra đúng đoạn; xóa bộ tài liệu là mất vĩnh viễn.

**Acceptance Scenarios**:

1. **Given** người dùng Pro, **When** dán/nạp văn bản dài vào một bộ tài liệu, **Then**
   nội dung được lập chỉ mục local, hiển thị số mục/dung lượng, sẵn sàng cho truy hồi.
2. **Given** kho có nhiều bộ, **When** bắt đầu phiên ghi, **Then** chọn được bộ tài liệu
   áp dụng cho phiên đó (hoặc tắt Copilot cho phiên).
3. **Given** một bộ tài liệu, **When** xóa và xác nhận, **Then** toàn bộ nội dung + chỉ
   mục biến mất vĩnh viễn khỏi máy.

---

### User Story 2 - Câu hỏi vang lên → trả lời có căn cứ hiện ra (Priority: P1)

Trong buổi họp/phỏng vấn đang ghi, khi đối phương đặt câu hỏi chạm tới tài liệu ("Điều
khoản bảo hành trong hợp đồng là gì?", "Con số hiệu năng của bản 2.0?"), overlay hiện thẻ
hai tầng: **(1) ngay lập tức** — các trích đoạn khớp nhất từ tài liệu, kèm nguồn (tài
liệu nào, mục nào); **(2) vài giây sau** — một câu trả lời đề xuất ngắn gọn được tổng hợp
*chỉ từ các trích đoạn đó*, kèm trích dẫn. Câu hỏi không có trong tài liệu → thẻ ghi rõ
"không tìm thấy trong tài liệu" (im lặng nếu độ tin cậy quá thấp). Người dùng đọc, diễn
đạt lại bằng lời của mình.

**Why this priority**: Đây chính là tính năng Pro chủ lực theo ý định đã làm rõ của chủ
dự án — giá trị "không cần nhớ chính xác tài liệu dày" cho cả hai persona.

**Independent Test**: Kho thử có 3 tài liệu ≥50 trang; phát audio 10 câu hỏi (7 có trong
tài liệu, 3 không) → trích đoạn đúng nguồn hiện ≤1.5s cho ≥80% câu có; câu trả lời đề
xuất luôn kèm trích dẫn; 3 câu không có → hiện "không tìm thấy", không bịa.

**Acceptance Scenarios**:

1. **Given** đang ghi + bộ tài liệu đã chọn + Pro, **When** câu chốt của "Đối phương" là
   câu hỏi, **Then** trích đoạn khớp (tối đa 3, kèm nguồn) hiện trên overlay ≤1.5s.
2. **Given** trích đoạn đã hiện, **When** bộ sinh on-device tổng hợp xong, **Then** câu
   trả lời đề xuất (2–4 câu) hiện kèm chỉ dấu nguồn cho từng ý; mọi ý PHẢI truy về được
   trích đoạn nguồn.
3. **Given** câu hỏi không khớp tài liệu, **When** phân tích xong, **Then** thẻ ghi
   "không tìm thấy trong tài liệu" hoặc im lặng (ngưỡng tin cậy) — KHÔNG BAO GIỜ hiện
   nội dung không có căn cứ.
4. **Given** thẻ đang hiện, **When** người dùng ẩn bằng một thao tác, **Then** thẻ biến
   mất, phụ đề không bị che.
5. **Given** câu hỏi bằng ngôn ngữ khác tài liệu, **When** truy hồi, **Then** matching
   vẫn hoạt động (dùng bản dịch câu hỏi sẵn có trong pipeline).

---

### User Story 3 - Rà soát sau buổi: trả lời của tôi có khớp tài liệu không (Priority: P2)

Sau buổi họp/phỏng vấn, người dùng Pro bấm "Rà soát": hệ thống liệt kê từng câu hỏi đã
được hỏi, phần trả lời thực tế của họ, và đối chiếu với tài liệu — chỗ nào trả lời khớp,
chỗ nào nói sai/thiếu so với tài liệu (kèm trích đoạn đúng), ý quan trọng nào bị bỏ sót.
Báo cáo bằng ngôn ngữ đích, nằm trong bản xuất Markdown.

**Why this priority**: Đúng mong muốn gốc "sau buổi phỏng vấn không cần nhớ đã hỏi/trả
lời gì để tự đánh giá"; không áp lực độ trễ nên chất lượng on-device đạt tốt.

**Independent Test**: Phiên thử có 6 cặp hỏi–đáp trong transcript (2 đáp sai so tài
liệu) → báo cáo liệt kê ≥90% câu hỏi, chỉ đúng 2 chỗ lệch kèm trích đoạn nguồn.

**Acceptance Scenarios**:

1. **Given** phiên hoàn tất + bộ tài liệu + Pro, **When** bấm rà soát, **Then** báo cáo
   theo từng câu hỏi: bạn trả lời gì → khớp/lệch/thiếu so tài liệu → trích đoạn đúng.
2. **Given** máy không hỗ trợ bộ sinh on-device, **When** bấm rà soát, **Then** thông báo
   rõ — KHÔNG dùng dịch vụ ngoài.
3. **Given** báo cáo đã tạo, **When** xuất Markdown phiên, **Then** báo cáo nằm trong file.

---

### User Story 4 - Luyện tập hỏi–đáp từ tài liệu (Priority: P3)

Người dùng Pro bấm "Luyện tập": hệ thống đặt câu hỏi rút từ bộ tài liệu (kiểu khách
hàng/nhà tuyển dụng sẽ hỏi), người dùng trả lời bằng giọng nói qua pipeline sẵn có, và
nhận đối chiếu với tài liệu sau từng câu. Phiên luyện lưu vào thư viện, đánh dấu "luyện tập".

**Why this priority**: Tăng tần suất dùng trước sự kiện quan trọng; phụ thuộc US1–US3.

**Acceptance Scenarios**:

1. **Given** bộ tài liệu có nội dung, **When** bắt đầu luyện, **Then** nhận được ≥5 câu
   hỏi liên quan trực tiếp nội dung tài liệu, bằng ngôn ngữ người dùng chọn.
2. **Given** trả lời xong một câu bằng mic, **When** chấm xong, **Then** thấy đối chiếu
   khớp/lệch kèm trích đoạn.

### Edge Cases

- Kho tài liệu rỗng mà Copilot bật → nhắc một lần, không lặp trong phiên.
- Hai câu hỏi liên tiếp → thẻ mới thay thẻ cũ; câu trả lời đề xuất của câu cũ bị hủy nếu
  chưa sinh xong (không xếp hàng gây trễ).
- Nano bận/đang tải model lần đầu → tầng trích đoạn (retrieval) vẫn chạy, chỉ tầng tổng
  hợp tắt kèm ghi chú — không tranh tài nguyên với Whisper (Constitution VI, SC-017).
- Tài liệu chứa nội dung mâu thuẫn nhau → trích đoạn hiện cả hai nguồn, câu tổng hợp phải
  nêu sự khác biệt thay vì chọn bừa.
- Phiên "chỉ phụ đề, không lưu" (spec 002) → thẻ trả lời vẫn chạy; rà soát sau buổi không
  khả dụng (nói rõ trước).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-031**: Người dùng Pro MUST tạo được nhiều bộ tài liệu tham chiếu (dán văn bản v1),
  dung lượng lớn (tổng ≥500 trang), lập chỉ mục và lưu hoàn toàn trên máy; sửa/xóa vĩnh
  viễn; chọn bộ áp dụng cho từng phiên.
- **FR-032**: Hệ thống MUST phát hiện câu hỏi trong câu chốt của "Đối phương" (không chạy
  trên phụ đề tạm) và truy hồi trích đoạn khớp từ bộ tài liệu đã chọn, xuyên ngôn ngữ.
- **FR-033**: Thẻ trả lời MUST hiển thị hai tầng: (1) trích đoạn nguyên văn kèm nguồn
  (≤1.5s, tối đa 3); (2) câu trả lời đề xuất tổng hợp on-device **chỉ từ các trích đoạn
  đó**, mọi ý truy về được nguồn. Không đủ căn cứ → MUST hiển thị "không tìm thấy trong
  tài liệu" hoặc im lặng theo ngưỡng tin cậy; MUST NOT hiển thị nội dung không căn cứ (D5).
- **FR-034**: Rà soát sau buổi MUST đối chiếu từng cặp hỏi–đáp trong transcript với tài
  liệu (khớp/lệch/thiếu + trích đoạn), chạy on-device, xuất kèm Markdown; máy không hỗ
  trợ → thông báo, không dùng dịch vụ ngoài.
- **FR-035**: Luyện tập MUST sinh câu hỏi từ nội dung bộ tài liệu, nhận trả lời qua
  pipeline phiên âm hiện có, đối chiếu sau từng câu, lưu phiên đánh dấu "luyện tập".
- **FR-036**: Toàn bộ Copilot MUST chạy on-device và dữ liệu không rời máy (Constitution
  I); bị gồm trong "xóa toàn bộ dữ liệu" (spec 002 FR-030).
- **FR-037**: Copilot MUST được gate bởi license Pro (spec 002 FR-029); không Pro → mọi
  tính năng free giữ nguyên, không chèn quảng cáo giữa phiên.
- **FR-038**: Copilot MUST không làm phụ đề live vượt mục tiêu độ trễ hiện có — truy hồi
  và tổng hợp chạy ở mức ưu tiên thấp hơn nhận dạng giọng nói.

### Key Entities

- **Bộ tài liệu (DocSet)**: tên, danh sách tài liệu, ngôn ngữ chính, cập nhật lúc.
- **Tài liệu (RefDoc)**: thuộc DocSet; tiêu đề, loại, nội dung; được chia **đoạn (Chunk)**
  ~200–400 token có chỉ mục truy hồi local.
- **Thẻ trả lời (AnswerCard)**: câu hỏi nguồn → trích đoạn khớp {nội dung, RefDoc, vị
  trí, điểm khớp} + câu trả lời đề xuất {văn bản, ánh xạ ý→trích đoạn}; tồn tại trong
  phiên, không bắt buộc persist.
- **Báo cáo rà soát (Review)**: gắn 1-1 phiên; {câu hỏi, trích trả lời của user, đánh giá
  khớp/lệch/thiếu, trích đoạn nguồn}; lưu trong record phiên.

## Success Criteria *(mandatory)*

- **SC-014**: Trích đoạn khớp hiện ≤1.5s sau khi câu hỏi chốt; đúng nguồn kỳ vọng ≥80%
  trên bộ 20 câu hỏi thử với kho ≥150 trang.
- **SC-015**: Câu trả lời đề xuất hiện ≤5s (p50) sau trích đoạn, trên máy chuẩn; 100% ý
  trong câu đề xuất truy về được trích đoạn nguồn (kiểm bằng bộ thử grounding).
- **SC-016**: Câu hỏi ngoài tài liệu: 0 trường hợp hiển thị nội dung bịa trong bộ thử
  (báo "không tìm thấy" hoặc im lặng).
- **SC-017**: SC-001 (phụ đề ≤2s) vẫn đạt khi Copilot bật, đo cùng phiên.
- **SC-018**: Rà soát phiên 60' hoàn tất ≤90s máy chuẩn, liệt kê ≥90% câu hỏi thực có.
- **SC-019**: Không request mạng nào trong toàn bộ luồng Copilot (giám sát network).

## Assumptions

- Chrome 138+ với Prompt API (Gemini Nano); máy không đủ điều kiện → tầng tổng hợp tắt,
  tầng trích đoạn (thuần truy hồi) vẫn chạy.
- Truy hồi v1: chấm điểm từ khóa/BM25 thuần JS trong `extension/lib/` (environment-agnostic,
  unit-test được — Constitution III); nâng cấp embedding local (model nhỏ ~30MB qua hạ
  tầng transformers.js sẵn có) khi dữ liệu dùng thật cho thấy cần.
- Ngữ cảnh Nano ~8K token đủ vì chỉ nạp câu hỏi + trích đoạn đã truy hồi, không nạp cả kho.
- V1 nạp tài liệu bằng dán văn bản; import PDF/DOCX cục bộ là mở rộng sau.
- Giá gói Pro chốt ở spec thương mại hóa riêng (D3).
