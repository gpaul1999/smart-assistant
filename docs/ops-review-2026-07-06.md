# Ops Review — đánh giá spec trước khi đi vào hoạt động

**Ngày**: 2026-07-06 · **Phương pháp**: gstack `/plan-ceo-review` (findings theo severity,
Completeness Principle) + Premise Challenge. **Đối tượng**: spec 001–004 + amendment D6
(toàn bộ đã implement, 77 unit + 20 E2E xanh, zip 0.5.0 store-ready).

---

## Phần 1 — Findings: tính khả thi khi VẬN HÀNH THẬT

### 🔴 F1 (CRITICAL) — Gemini Nano không có mặt trên đa số máy người dùng

**Vấn đề**: 3 tính năng bán hàng (dịch live, tóm tắt, Copilot suggestion) dựa trên
Translator/Summarizer/Prompt API — cần Chrome 138+, ổ trống lớn để tải Nano, RAM/GPU đủ.
Trên máy văn phòng phổ thông VN, tỷ lệ đủ điều kiện **không cao**. Code đã degrade mượt
(fallback extractive, Copilot còn tầng trích đoạn), nhưng **marketing hứa "dịch live" mà
máy user không chạy được = 1 sao trên store**.

**Việc phải làm trước beta**: (a) **Trang "Năng lực máy của bạn"** trong onboarding +
panel: check từng API (Translator/Summarizer/Nano/WebGPU) và nói thẳng cái gì chạy/không;
(b) store listing ghi rõ yêu cầu; (c) đo tỷ lệ đủ-điều-kiện trên 5 người dùng thử đầu tiên
— con số này quyết định messaging.

### 🔴 F2 (CRITICAL) — Chất lượng Whisper tiếng Việt trên máy yếu chưa được đo thật

Benchmark tự chọn model đã có, nhưng **chưa ai đo RTF + accuracy tiếng Việt trên laptop
văn phòng thật**. Nếu tiny cho phụ đề vi sai >30%, aha-moment chết ở đúng thị trường mục
tiêu. **Không code thêm gì sửa được finding này — chỉ có dogfood** (assignment #2 cũ, vẫn
chưa làm). Phương án dự phòng nếu tệ: định vị live = "gist tiếng Anh", tiếng Việt dựa vào
re-transcribe Small sau buổi (đã có).

### 🟠 F3 (HIGH) — Store review với bộ permission nặng

`tabCapture + desktopCapture + scripting + tabs + notifications + storage + offscreen` là
hồ sơ "extension giám sát" điển hình → review lâu, dễ bị từ chối vòng đầu. **Giảm rủi ro**:
justification từng permission trong listing; demo video; privacy policy đã tốt; cân nhắc
bỏ `notifications`+`tabs` khỏi bản đầu (nudge là tính năng phụ — bỏ đi làm hồ sơ nhẹ hẳn,
thêm lại sau khi có user). Đây là trade-off đáng chốt trước khi nộp.

### 🟠 F4 (HIGH) — Tải model từ HuggingFace là điểm hỏng vận hành

HF chậm/chặn ở nhiều mạng công ty và một số quốc gia; 40–150MB lần đầu trên mạng yếu =
onboarding chết ở bước 3. Code đã cho đi tiếp khi tải lỗi, nhưng user đó **chưa từng thấy
sản phẩm chạy**. **Đề xuất**: (a) retry + resume (Cache API giữ phần đã tải theo file);
(b) phương án mirror tự host (model là data công khai, không vi phạm constitution — nhưng
tốn tiền băng thông, để sau khi có doanh thu); (c) "Import model từ file" cho power user.

### 🟠 F5 (HIGH) — Vòng bán license chưa có đầu "ký key"

Verify offline đã xong, nhưng **chưa có gì ký key khi khách trả tiền**. Cần 1 webhook
serverless duy nhất: LemonSqueezy/Gumroad → gọi hàm ký Ed25519 → email key cho khách.
Hàm này KHÔNG nhận bất kỳ dữ liệu họp nào (chỉ email đơn hàng) — hợp Constitution I.
Lưu ý mô hình: key offline **không thu hồi được** → nên phát hành key có `exp` (1 năm,
gia hạn = key mới) thay vì lifetime vĩnh viễn, trừ khi chủ dự án chấp nhận rủi ro share key.

### 🟡 F6 (MEDIUM) — Không telemetry = mù khi vận hành (đúng constitution, nhưng phải bù)

Ta sẽ không biết crash rate, tỷ lệ Nano-available, RTF thực tế. **Bù bằng cách local-first**:
nút "Xuất chẩn đoán" trong panel Dữ liệu — gom bench, version, capability check, lỗi gần
nhất (log vòng tròn trong storage) thành file JSON để **user tự đính kèm** khi báo lỗi.
Zero network, user chủ động — vẫn đúng nguyên tắc.

### 🟡 F7 (MEDIUM) — Mic-only trong họp ONLINE sẽ vọng giọng chính user

Chế độ Chỉ mic thiết kế cho trực tiếp/loa ngoài; nếu user dùng nó cho Google Meet (thay vì
Tab mode) với loa laptop, EC tắt → transcript sẽ lặp. **Sửa rẻ**: một dòng hint ngay dưới
selector khi chọn Chỉ mic ("dùng cho gặp trực tiếp / điện thoại; họp trong Chrome hãy chọn
Tab") — tránh 50% ticket hỗ trợ tương lai.

### 🟡 F8 (MEDIUM) — UI đang hứa "PDF/DOCX sắp có"

Lời hứa trong sản phẩm là nợ. Hoặc ship PDF/DOCX local sớm (pdf.js vendor + DOCX qua
DecompressionStream — 2-3 ngày công), hoặc đổi copy thành "chưa hỗ trợ". Đừng để chữ
"sắp có" sống quá một release.

### 🟡 F9 (MEDIUM) — Đồng hồ cạnh tranh vẫn chạy

Meet speech-translation GA cho business (2/2026) sẽ trượt dần xuống gói thấp. Moat còn lại
theo thứ tự bền: (1) Copilot tài liệu riêng tư (nền tảng KHÔNG BAO GIỜ làm — dữ liệu của
user, không phải của host), (2) mọi-nền-tảng + không bot, (3) local/NDA-safe. **Kết luận
chiến lược: dồn lực marketing vào Copilot, không phải phụ đề.**

---

## Phần 2 — Cỗ máy kiếm tiền: audit gate Free/Pro

| Gate | Đánh giá | Phản biện |
|---|---|---|
| Kho 3.000 ký tự (free) → không giới hạn (Pro) | ✅ **Gate chủ lực, đúng** | CV+JD+ghi chú ≈ 8–15k ký tự → user phỏng vấn đụng trần NGAY buổi chuẩn bị đầu tiên = trigger nâng cấp đúng khoảnh khắc đau. Copy nút nâng cấp phải nằm ngay tại thông báo chặn (đã có) |
| Nhập file (Pro) | ✅ Convenience đúng chỗ | Không phải gate thật (paste bypass được) — là "dầu bôi trơn" cho gate ký tự |
| Rà soát phỏng vấn (Pro) | ✅ Đúng | Giá trị sau-buổi, không phá aha free |
| Whisper Small re-transcribe (Pro) | ⚠️ Yếu một mình | Chỉ có nghĩa với user tiếng Việt hiểu model là gì. Nên đổi copy thành "Phiên âm lại chất lượng cao" (ẩn tên model) |
| **Thiếu**: lý do QUAY LẠI hằng tuần cho Pro | 🔴 | Pro hiện bán "một lần chuẩn bị phỏng vấn". Cần giá trị lặp lại — xem đề xuất U2/U3 |

**Đề xuất giá (chốt bởi founder)**: Pro **$4.99/tháng** hoặc **$29/năm** (VN: 99k/tháng,
599k/năm); key `exp` 1 năm. Neo: "rẻ hơn 1/3 so với Workspace Business chỉ để có phụ đề
dịch — và cái này là CỦA BẠN, chạy mọi nền tảng".

---

## Phần 3 — Đề xuất tính năng nâng cấp (impact × effort)

### Gói A — "Ops-hardening" (làm TRƯỚC beta, ~2-3 ngày, phần lớn nhỏ)

| # | Tính năng | Giải quyết | Effort |
|---|---|---|---|
| A1 | Trang/khối "Năng lực máy" (check Translator/Summarizer/Nano/WebGPU + kết quả bench) | F1 | S |
| A2 | Nút "Xuất chẩn đoán" local (bench + capability + error ring-buffer) | F6 | S |
| A3 | Hint theo chế độ nguồn âm trong popup | F7 | XS |
| A4 | Retry/resume tải model + thông báo lỗi mạng tử tế | F4 | M |
| A5 | Quyết định permission trim (bỏ nudge?) + viết justification store | F3 | S |
| A6 | Xuất phụ đề `.srt/.vtt` từ thư viện (tận dụng segments, rẻ mà hay được hỏi) | retention | S |

### Gói B — "Pro value pack" (tăng lý do trả tiền + quay lại)

| # | Tính năng | Vì sao đáng tiền | Effort |
|---|---|---|---|
| B1 | **PDF/DOCX import local** (pdf.js vendor + DOCX DecompressionStream) | Trả nợ F8; hợp đồng/CV thật đều là PDF/DOCX — gate file mới thành thật | M |
| B2 | **Email follow-up tự soạn** (Nano local: tóm tắt + action items → draft email song ngữ, copy 1 click) | Persona họp khách hàng dùng MỖI buổi họp = giá trị lặp lại hằng tuần mà Pro đang thiếu | M |
| B3 | Mock interview (US4 đã defer) | Tần suất trước sự kiện; chỉ build khi demand test xác nhận persona phỏng vấn | M |
| B4 | Embedding search local (nâng BM25) khi kho >100 trang | Chất lượng recall cho power user | L |

### Gói C — Retention nền

| # | Tính năng | Effort |
|---|---|---|
| C1 | Tìm kiếm toàn thư viện (U7 từ office-hours đầu — vẫn chưa làm) | M |
| C2 | Tag/lọc phiên theo docset/khách hàng | S |

## Khuyến nghị thứ tự

**A (toàn bộ) → nộp store beta → chạy demand test (3 assignments) → B2 → B1 → theo tín
hiệu: B3 hoặc C1.** Không build gói B trước khi có ≥5 người dùng thật — kỷ luật D1 vẫn
đứng. B2 được ưu tiên hơn B1 vì nó tạo thói quen dùng hằng tuần (chống churn) trong khi
B1 chỉ làm sâu thêm giá trị lúc mua.

## Việc chỉ founder làm được (không đổi so với office-hours, vẫn chưa chạy)

1. 5 cuộc nói chuyện với người phỏng vấn ngoại ngữ (14 ngày).
2. Dogfood 2 buổi thật — đo F1/F2 bằng máy thật.
3. Chốt giá + cổng thanh toán; sinh keypair production (`make-license.mjs --keygen`, cất
   private key an toàn); mốc store beta 30 ngày.


---

## Quyết định đã chốt (founder, 2026-07-06) + trạng thái Gói A

| Quyết định | Chốt |
|---|---|
| Bước tiếp theo | **Gói A ops-hardening** → nộp store beta |
| Giá Pro | **$4.99/tháng · $29/năm** (VN 99k/599k), key `exp` 1 năm |
| F3 trim permission | **Bỏ nudge bản đầu** (gỡ `tabs` + `notifications`) |

**Gói A đã ship cùng ngày** (manifest 0.6.0): A1 Năng lực máy (onboarding + panel viewer,
`lib/capabilities.js`), A2 Xuất chẩn đoán local (`lib/diag.js` + errlog ring buffer trong
background — không chứa nội dung họp, test chống rò), A3 hint theo nguồn âm trong popup,
A4 retry tải model + reset promise lỗi (`transcriber.js`), A5 gỡ nudge + `docs/store-listing.md`
(justification từng permission, yêu cầu hệ thống trung thực), A6 xuất `.srt` (+`buildVtt`)
từ thư viện. Gate: **82 unit + 20 E2E xanh**, zip 0.6.0.
