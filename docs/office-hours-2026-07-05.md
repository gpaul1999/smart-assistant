# Office Hours — Phản biện sản phẩm Smart Meeting Assistant

**Ngày**: 2026-07-05 · **Phương pháp**: gstack `/office-hours` startup mode (fork pin `11de390`),
chạy Phase 3 (Premise Challenge) + Phase 4 (Alternatives) vì đã có spec/plan đầy đủ.
**Mục tiêu chủ dự án**: "thân thiện với người dùng tuyệt đối, cạnh tranh được, kiếm tiền được."

---

## Phase 2 rút gọn — Status quo & bối cảnh cạnh tranh (Q2)

Người dùng mục tiêu hiện giải quyết vấn đề thế nào (đối thủ thật = status quo):

| Giải pháp hiện tại | Giá | Điểm mạnh | Điểm yếu với persona của ta |
|---|---|---|---|
| Ghi chú tay / trí nhớ | 0đ | không cài gì | sót thông tin, không dịch |
| Tactiq (Chrome ext) | Free 10 cuộc/tháng, Pro ~$20/mo | setup nhanh, bám caption Meet | cloud (dữ liệu rời máy), không dịch live cho người nghe yếu |
| Otter.ai | Free 300', Pro ~$8.33/mo | realtime tốt, cộng tác | cloud, bot lộ diện, tiếng Việt yếu |
| Fathom | **Free không giới hạn** | miễn phí hào phóng | cloud + bot join call — lộ với nhà tuyển dụng |
| Fireflies | Free transcript | tích hợp CRM | cloud, hướng sales team |
| **Meetily** (open source) | 0đ self-host | **100% local**, diarization, 4x Whisper | app desktop phải cài, kỹ thuật, không dịch live |
| **Notta Privacy Mode** (7/2026) | trả phí | local, không bot | app desktop, mới, không nhắm interview |

**Kết luận Q2 (vị thế)**: "local" đơn thuần đã có người làm. Vùng còn trống thật sự:
**(a)** chạy ngay trong Chrome — không cài app desktop, không bot lộ diện trong call;
**(b)** **dịch trực tiếp on-device cho người nghe ngoại ngữ chưa vững** — không notetaker
nào ở bảng trên làm live translation local; **(c)** nhãn "Bạn/Đối phương" phục vụ ôn lại
phỏng vấn. Đây là wedge, không phải "local-first" chung chung.

---

## Phase 3 — Premise Challenge (phản biện từng tiền đề)

### P1. "Local-first là lợi thế cạnh tranh chính" — **SAI MỘT NỬA**

**Phản biện**: Meetily/Notta/Off Grid đã chiếm chữ "local". Nếu pitch là "meeting recorder
local", ta thua Meetily (miễn phí, open source, diarization tốt hơn) và thua Fathom (free
unlimited, dễ hơn). **Vị trí đúng**: local là *điều kiện nền* (bảng giá 0đ server → free tier
hào phóng được), còn **giá trị bán** là "phụ đề + dịch trực tiếp trong phỏng vấn/cuộc họp
ngoại ngữ, không ai biết bạn đang dùng". Bằng chứng làm tôi đổi ý: nếu user thật nói họ chọn
ta *vì* local chứ không vì dịch — thì đảo lại messaging.

### P2. "Whisper tiny mặc định là đủ" — **SAI, đây là rủi ro #1 giết sản phẩm**

**Phản biện**: "Thân thiện tuyệt đối" chết ngay ở đây: phụ đề sai be bét (đặc biệt tiếng
Việt, tiếng Nhật với tiny/base) → user gỡ extension trong 5 phút đầu, không có cơ hội thứ
hai. Độ trễ 2s vô nghĩa nếu chữ sai. **Quyết định thiết kế mới**:
1. **Benchmark máy lúc onboarding** (chạy 5s inference thử) → tự chọn model lớn nhất giữ
   được ≤2s; không bắt user hiểu "tiny/base/small".
2. **WebGPU** (transformers.js v3 hỗ trợ) khi có → Whisper small/turbo vẫn realtime; WASM
   chỉ là fallback. Đây phải nâng từ "roadmap" lên ưu tiên cao.
3. Định vị trung thực trong UI: phụ đề live = "bản nháp nhanh", bản chính xác có sau khi
   dừng (re-transcribe chất lượng cao tự động cho phiên < 30' nếu máy cho phép).

### P3. "Cửa sổ phụ đề riêng là đủ thân thiện" — **SAI với persona phỏng vấn**

**Phản biện**: Đang phỏng vấn mà phải liếc sang cửa sổ khác = lộ ánh mắt, mất tập trung —
đúng khoảnh khắc căng thẳng nhất của user. **Thay thế**: overlay phụ đề **trong chính tab
họp** (content script, như phụ đề phim, kéo-thả vị trí, chỉnh cỡ chữ); cửa sổ riêng thành
fallback cho trang chặn content script. Một pipeline, chỉ thêm nơi hiển thị (Constitution V an toàn).

### P4. "Cứ build xong là có người dùng" — **CHƯA CÓ BẰNG CHỨNG CẦU (gap lớn nhất)**

**Phản biện**: Hiện chưa có một người dùng thật nào (kể cả bản thân chủ dự án trong một buổi
phỏng vấn thật). Interest ≠ demand; chưa ai "sẽ khó chịu nếu sản phẩm biến mất". Không code
nào sửa được gap này — chỉ có assignments (cuối file).

### P5. "Extension tự nó là kênh phân phối" — **THIẾU: chưa có đường tới user**

**Phản biện**: Hiện tại cài bằng load-unpacked = chỉ dev dùng được. Không Chrome Web Store
listing = không có sản phẩm. Store review với quyền `tabCapture` + mic cần privacy policy
rõ (may mắn: câu chuyện local-first là chính sách privacy dễ viết nhất thế giới). Phải thành
task có deadline, không phải "roadmap".

### P6. "Ghi âm phỏng vấn cứ thế mà làm" — **RỦI RO PHÁP LÝ/ĐẠO ĐỨC chưa xử lý**

**Phản biện**: Ghi âm 2 chiều có luật consent (nhiều bang US cần two-party consent; EU
GDPR). Nếu bán cho người đi phỏng vấn mà lờ chuyện này → rủi ro cho user và cho danh tiếng
sản phẩm. **Quyết định**: (a) first-run notice ngắn gọn "kiểm tra luật ghi âm nơi bạn ở +
điều khoản nền tảng họp"; (b) không marketing kiểu "ghi lén" — messaging là *trợ thính ngôn
ngữ + ôn tập của chính bạn*; (c) phụ đề/dịch live (không lưu) là mode không rủi ro — cân
nhắc "chỉ phụ đề, không ghi âm" như một lựa chọn khi bắt đầu.

### P7. "Freemium gate tính năng dịch" — **SAI CHIỀU GATE**

**Phản biện**: Dịch live là *lý do tồn tại* với persona phỏng vấn — gate nó = giết trải
nghiệm đầu tiên, user không bao giờ thấy "aha". **Chiều đúng** (học Fathom: free hào phóng
để lan truyền, vì ta không tốn server): free = ghi + phụ đề + dịch + tóm tắt **không giới
hạn số cuộc**; Pro gate các thứ "power": re-transcribe chất lượng cao (WebGPU/small), xuất
nâng cao, thư viện >N phiên gần nhất, (tương lai) đánh giá buổi phỏng vấn. Thanh toán:
license key qua ExtensionPay/LemonSqueezy — chỉ gửi key, không gửi dữ liệu họp (Constitution
I giữ nguyên).

---

## UX Audit — "thân thiện tuyệt đối" nghĩa là gì, cụ thể

Nguyên tắc: đo bằng **time-to-first-aha** (cài → thấy phụ đề dịch đúng lần đầu) < 3 phút.

| # | Ma sát hiện tại | Sửa thành | Ưu tiên |
|---|---|---|---|
| U1 | Load unpacked, không có store listing | Publish Chrome Web Store (beta unlisted trước) | **P0** |
| U2 | Cài xong không biết làm gì | Trang onboarding tự mở sau khi cài: 3 bước (mic → chọn ngôn ngữ dịch → nút thử ngay trên video demo) | **P0** |
| U3 | Model 40–150MB tải im lặng lúc bắt đầu ghi | Onboarding xin phép tải trước + progress; benchmark chọn model theo máy | **P0** |
| U4 | Phụ đề ở cửa sổ riêng | Overlay trong tab họp (mặc định), kéo-thả, chỉnh cỡ chữ; cửa sổ riêng = fallback | **P1** |
| U5 | Quên bấm ghi = mất buổi họp | Nhận diện domain họp (meet.google.com, zoom.us, teams) → badge gợi ý + notification "Bắt đầu ghi?" (không bao giờ tự ghi) | **P1** |
| U6 | Whisper tiny sai nhiều với vi/ja | WebGPU + auto-model theo máy (P2 ở trên) | **P1** |
| U7 | Thư viện không tìm kiếm được | Search full-text local trong transcript/tóm tắt | **P2** |
| U8 | UI chỉ tiếng Việt | i18n (chrome.i18n) vi + en để bán quốc tế | **P2** |
| U9 | "Local" là lời hứa suông với user thường | Panel "Dữ liệu của bạn": tổng dung lượng, nơi lưu, nút xóa tất cả, link mã nguồn | **P2** |
| U10 | Chưa có consent/luật ghi âm | First-run notice + tùy chọn "chỉ phụ đề, không ghi âm" | **P1** |

---

## Phase 4 — Alternatives (các hướng đi, chọn một)

**A. Generalist**: "Meeting recorder local trong Chrome" — đối đầu Tactiq/Fathom/Meetily.
*Loại*: không có câu trả lời cho "sao không dùng Fathom free?".

**B. Wedge phỏng vấn song ngữ (khuyến nghị)**: "Trợ lý phỏng vấn & họp ngoại ngữ — phụ đề
dịch trực tiếp, riêng tư tuyệt đối, không bot". Người mua rõ (career consequence), nỗi đau
nóng (buổi phỏng vấn tuần này), vùng trống thật (không ai làm live translation on-device
trong browser). Pipeline không đổi (Constitution V) — chỉ messaging, landing, thứ tự ưu
tiên UX nhắm persona này trước. Persona "họp dài" vẫn được phục vụ nguyên vẹn, trở thành
use case mở rộng tự nhiên.

**C. Desktop app kiểu Meetily**: *Loại* — sân đã đông, mất lợi thế "không cài app".

---

## Assignments (việc chỉ founder làm được — code không thay thế được)

1. **Demand test (14 ngày)**: nói chuyện với 5 người sắp/vừa phỏng vấn bằng ngoại ngữ.
   Hỏi: họ đã làm gì buổi trước (status quo)? Cho xem demo 60s — có ai hỏi "bao giờ tôi
   dùng được?" không? Có ai chịu trả trước 99k không?
2. **Dogfood**: chính bạn dùng nó trong 2 cuộc họp/phỏng vấn thật, ghi lại mọi khoảnh khắc
   lúng túng (đây là Q5 Observation của chính mình).
3. **Store listing**: đăng beta unlisted lên Chrome Web Store trong 30 ngày (U1) — trước
   khi tối ưu thêm bất kỳ tính năng nào khác.

---

## Quyết định ĐÃ CHỐT bởi chủ dự án (2026-07-05, qua AskUserQuestion)

| # | Câu hỏi | Quyết định |
|---|---|---|
| D1 | Bằng chứng cầu | **Chưa có — mới là trực giác** → Assignments 1–3 là việc bắt buộc của founder, chạy song song với build; KHÔNG build tính năng lớn nào ngoài spec 002 trước khi có tín hiệu từ 5 cuộc nói chuyện |
| D2 | Định vị | **Wedge phỏng vấn song ngữ** — messaging/landing/UX ưu tiên persona phỏng vấn; pipeline chung không đổi |
| D3 | Kiếm tiền | **Freemium**: free không giới hạn (ghi+phụ đề+dịch+tóm tắt) để lan truyền; Pro gate power features (re-transcribe HQ, export nâng cao, thư viện sâu, đánh giá phỏng vấn) — license key, không gửi dữ liệu họp |
| D4 | Phụ đề | **Overlay trong tab họp làm mặc định**; cửa sổ riêng là fallback |

Kết quả được encode thành **`specs/002-interview-first-ux/`** (spec-kit). Vì D1 = chưa có
bằng chứng, phạm vi 002 giới hạn ở các mục đưa sản phẩm **đến được tay người thử** (store
beta, onboarding, chất lượng phụ đề, overlay) — không nở thêm cho tới khi assignments có
kết quả.
