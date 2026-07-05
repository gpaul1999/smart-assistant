# Feature Specification: Trợ lý cuộc họp local-first (baseline sản phẩm)

**Feature Branch**: `001-meeting-assistant-core`

**Created**: 2026-07-05

**Status**: Draft

**Input**: User description: "Trợ lý cuộc họp local-first (một pipeline chung cho mọi persona):
ghi đồng thời tiếng đối phương + giọng mình trong tab họp online; phụ đề trực tiếp ≤2s kèm bản
dịch; gắn nhãn ai nói; tóm tắt điểm chính + action items sau khi dừng; thư viện nghe lại/xuất/
xóa/phiên âm lại; toàn bộ dữ liệu ở lại trên máy. Bao gồm các yêu cầu chưa đạt ở v0.1:
audio sống sót khi crash, trải nghiệm tải model lần đầu, quản lý dung lượng, phiên >1 giờ."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ghi lại cuộc họp và xem lại toàn bộ nội dung (Priority: P1)

Người dùng đang ở trong một cuộc họp online (Google Meet/Zoom web/Teams web). Họ bấm một nút
để bắt đầu ghi; hệ thống thu đồng thời tiếng những người khác (âm thanh cuộc họp) và giọng của
chính họ (micro). Khi họp xong, họ bấm dừng; hệ thống lưu bản ghi âm, bản chữ (transcript) có
mốc thời gian và nhãn người nói ("Bạn" / "Đối phương") vào thư viện trên máy. Bất kỳ lúc nào
sau đó, họ mở thư viện, nghe lại đoạn bất kỳ bằng cách bấm vào mốc thời gian, và đọc lại toàn
bộ lời thoại.

**Why this priority**: Đây là giá trị lõi — "không bỏ sót thông tin nào của cuộc họp". Mọi
tính năng khác (dịch, tóm tắt) đều xây trên dữ liệu của luồng này. Một mình nó đã là MVP.

**Independent Test**: Ghi một cuộc họp giả lập (phát audio trong tab + nói vào mic), dừng,
mở thư viện: nghe lại được audio, thấy transcript đúng nội dung với timestamp và nhãn người
nói, không có dữ liệu nào được gửi ra khỏi máy (kiểm chứng bằng theo dõi network).

**Acceptance Scenarios**:

1. **Given** người dùng ở tab cuộc họp và đã cấp quyền micro, **When** bấm "Bắt đầu ghi",
   **Then** hệ thống ghi cả hai nguồn âm, hiển thị trạng thái đang ghi (badge/timer), và âm
   thanh cuộc họp vẫn nghe được bình thường.
2. **Given** đang ghi, **When** bấm "Dừng ghi", **Then** trong thời hạn chấp nhận được (xem
   SC-004) thư viện có mục mới với audio nghe lại được, transcript đầy đủ, thời lượng đúng.
3. **Given** một mục trong thư viện, **When** bấm mốc thời gian của một câu, **Then** trình
   phát nhảy tới đúng đoạn đó và phát.
4. **Given** người dùng chưa cấp quyền micro, **When** bắt đầu ghi, **Then** hệ thống vẫn ghi
   được phía đối phương và thông báo rõ rằng giọng của họ không được thu.

---

### User Story 2 - Phụ đề trực tiếp kèm bản dịch khi nghe chưa thành thạo (Priority: P2)

Người dùng tham gia phỏng vấn (hoặc họp) bằng ngôn ngữ họ nghe chưa vững. Trong lúc ghi, một
cửa sổ phụ đề hiển thị lời thoại gần như tức thời: phần "đang nghe" xuất hiện tối đa ~2 giây
sau lời nói, sau đó được chốt thành câu hoàn chỉnh kèm bản dịch sang ngôn ngữ họ chọn. Mỗi
câu ghi rõ ai nói. Nhờ đó họ theo kịp cuộc trò chuyện theo thời gian thực.

**Why this priority**: Là lý do trả tiền của persona phỏng vấn — nhưng phụ thuộc hạ tầng thu
âm của Story 1 nên xếp P2.

**Independent Test**: Phát một đoạn hội thoại ngoại ngữ trong tab, mở cửa sổ phụ đề: đo thời
gian từ lời nói đến khi chữ xuất hiện (≤2s trên máy chuẩn), xác nhận câu chốt có bản dịch
đúng ngôn ngữ đích và nhãn người nói đúng nguồn phát.

**Acceptance Scenarios**:

1. **Given** đang ghi và cửa sổ phụ đề mở, **When** có người nói, **Then** phụ đề tạm xuất
   hiện trong ≤2s (máy chuẩn, cấu hình mặc định) ở trạng thái phân biệt được với câu đã chốt.
2. **Given** người nói ngắt hơi, **When** hệ thống chốt câu, **Then** câu chốt thay thế phụ đề
   tạm, kèm bản dịch sang ngôn ngữ đã chọn và nhãn "Bạn"/"Đối phương".
3. **Given** máy yếu hoặc cấu hình nhận dạng nặng, **When** phiên âm không theo kịp thời gian
   thực, **Then** phụ đề tạm thưa nhịp dần nhưng không câu chốt nào bị mất và độ trễ không
   tích lũy.
4. **Given** trình duyệt không hỗ trợ dịch on-device, **When** ghi âm, **Then** phụ đề vẫn
   hoạt động (không dịch) và người dùng được thông báo lý do.

---

### User Story 3 - Tóm tắt điểm chính & việc cần làm sau cuộc họp (Priority: P2)

Sau cuộc họp dài với khách hàng, người dùng không cần nhớ mọi chi tiết: mở thư viện là thấy
bản tóm tắt các điểm chính và danh sách việc cần làm (action items) được trích tự động từ nội
dung. Nếu họ nghe chưa vững ngôn ngữ cuộc họp, các điểm chính có kèm bản dịch.

**Why this priority**: Giá trị lõi của persona "họp dài" và là bước "nhớ lại từng point";
phụ thuộc transcript của Story 1 nên xếp P2 ngang Story 2.

**Independent Test**: Nạp một transcript mẫu có chứa các câu cam kết/deadline, chạy bước tổng
hợp: kết quả có ≥1 điểm chính đúng trọng tâm và bắt được các câu hành động (vi lẫn en).

**Acceptance Scenarios**:

1. **Given** một phiên ghi vừa dừng có nội dung thảo luận, **When** pipeline hoàn tất,
   **Then** mục thư viện hiển thị các điểm chính (bullet) và action items (nếu có).
2. **Given** người dùng đã chọn ngôn ngữ đích khác ngôn ngữ họp, **When** tóm tắt xong,
   **Then** các điểm chính có thêm bản dịch sang ngôn ngữ đích.
3. **Given** bộ tóm tắt on-device không khả dụng hoặc không phản hồi trong thời hạn, **When**
   pipeline chạy, **Then** hệ thống dùng phương án dự phòng và vẫn cho ra tóm tắt.

---

### User Story 4 - Quản lý dữ liệu: xuất, xóa, phiên âm lại (Priority: P3)

Người dùng sở hữu dữ liệu của mình: đổi tiêu đề cuộc họp; xuất biên bản dạng Markdown/JSON và
file audio để chia sẻ hoặc lưu trữ nơi khác; xóa vĩnh viễn một cuộc họp; hoặc chạy lại phiên
âm bằng cấu hình chính xác hơn khi cần bản chữ chất lượng cao hơn (giữ nguyên nhãn người nói).

**Why this priority**: Cần cho sử dụng lâu dài và niềm tin "dữ liệu là của tôi", nhưng không
chặn giá trị lõi.

**Independent Test**: Với một phiên đã hoàn tất trong thư viện: xuất từng định dạng và kiểm
tra nội dung; xóa và xác nhận biến mất; phiên âm lại và so sánh transcript mới/cũ.

**Acceptance Scenarios**:

1. **Given** một mục thư viện, **When** xuất Markdown, **Then** file chứa tiêu đề, thời gian,
   tóm tắt, action items và transcript song ngữ đầy đủ.
2. **Given** một mục thư viện, **When** xóa và xác nhận, **Then** cả bản ghi âm lẫn transcript
   biến mất vĩnh viễn khỏi máy; không khôi phục được.
3. **Given** một mục đã có audio, **When** yêu cầu phiên âm lại bằng cấu hình chính xác hơn,
   **Then** transcript mới thay thế bản cũ, nhãn người nói được giữ, tóm tắt được tính lại.

---

### User Story 5 - Độ bền phiên ghi: crash, phiên dài, lần chạy đầu (Priority: P3)

Người dùng tin được rằng bản ghi không "bốc hơi": nếu trình duyệt/máy sập giữa chừng, phần đã
ghi đến thời điểm đó vẫn còn (cả audio lẫn transcript) và được đánh dấu là phiên bị gián đoạn.
Phiên họp dài (tới 3 giờ) vẫn ghi và phiên âm lại được. Lần dùng đầu tiên, việc chuẩn bị bộ
nhận dạng (tải model một lần) hiển thị tiến độ rõ ràng thay vì im lặng. Khi dung lượng lưu trữ
đầy dần, người dùng thấy mức sử dụng và được cảnh báo trước khi không thể ghi thêm.

**Why this priority**: Các thuộc tính "sản phẩm thương mại đáng tin" — chưa đạt ở v0.1, cần
thiết trước khi thu tiền, nhưng không thay đổi luồng giá trị lõi.

**Independent Test**: Kill tiến trình giữa phiên ghi giả lập rồi mở lại và kiểm tra mục "gián
đoạn"; chạy phiên dài giả lập; xóa cache model và đo trải nghiệm lần đầu; bơm dữ liệu tới gần
đầy quota và quan sát cảnh báo.

**Acceptance Scenarios**:

1. **Given** đang ghi được ≥1 phút, **When** tiến trình bị kill đột ngột, **Then** sau khi mở
   lại, thư viện có mục "bị gián đoạn" chứa audio và transcript tới gần thời điểm sập (mất tối
   đa một khoảng đệm ngắn định trước — xem SC-006).
2. **Given** một phiên ghi 3 giờ, **When** dừng và yêu cầu phiên âm lại, **Then** quá trình
   hoàn tất mà không cạn bộ nhớ, có tiến độ hiển thị.
3. **Given** lần đầu sử dụng, **When** bắt đầu ghi, **Then** người dùng thấy tiến độ chuẩn bị
   model (%), và các lần sau không phải chờ lại.
4. **Given** dung lượng lưu trữ sắp đầy, **When** người dùng mở popup/thư viện, **Then** thấy
   mức sử dụng và cảnh báo, kèm gợi ý xóa/xuất bớt phiên cũ.

### Edge Cases

- Tab cuộc họp bị đóng giữa chừng khi đang ghi → phiên phải tự chốt như khi bấm dừng.
- Người dùng bấm ghi trên tab không hỗ trợ (trang nội bộ trình duyệt) → chặn với thông báo rõ.
- Hai lệnh ghi đồng thời (bấm ở 2 cửa sổ) → chỉ một phiên được phép, lệnh sau bị từ chối rõ ràng.
- Cả cuộc họp im lặng (không ai nói) → không sinh transcript rác; mục thư viện vẫn hợp lệ.
- Người dùng nói chen với đối phương cùng lúc → nhãn người nói được phép là "Cả hai".
- Ngôn ngữ họp không dịch được sang ngôn ngữ đích → phụ đề gốc vẫn chạy, thông báo không dịch được.
- Mất mạng hoàn toàn sau lần tải model đầu → mọi chức năng vẫn hoạt động (offline hoàn toàn).
- Yêu cầu phiên âm lại khi đang ghi phiên khác → xếp hàng hoặc từ chối rõ ràng, không tranh tài nguyên.

## Requirements *(mandatory)*

### Functional Requirements

**Thu âm & phiên ghi**

- **FR-001**: Hệ thống MUST ghi đồng thời âm thanh cuộc họp (phía đối phương) và micro người
  dùng từ tab họp đang mở, bằng một thao tác bắt đầu duy nhất.
- **FR-002**: Hệ thống MUST tiếp tục phát âm thanh cuộc họp cho người dùng nghe bình thường
  trong khi ghi.
- **FR-003**: Hệ thống MUST hoạt động được khi thiếu quyền micro (chỉ ghi phía đối phương)
  và thông báo rõ giới hạn này.
- **FR-004**: Hệ thống MUST hiển thị trạng thái đang ghi (chỉ báo + thời gian đã ghi) và cho
  dừng từ cùng nơi đã bắt đầu.
- **FR-005**: Hệ thống MUST chỉ cho phép một phiên ghi tại một thời điểm.

**Phụ đề trực tiếp & dịch**

- **FR-006**: Hệ thống MUST hiển thị phụ đề tạm ("đang nghe") trong lúc nói và thay bằng câu
  chốt khi người nói ngắt hơi; phụ đề tạm phân biệt được bằng mắt với câu chốt.
- **FR-007**: Hệ thống MUST gắn nhãn nguồn phát cho mỗi câu chốt: "Bạn", "Đối phương" hoặc
  "Cả hai".
- **FR-008**: Hệ thống MUST dịch câu chốt (và điểm chính của tóm tắt) sang ngôn ngữ đích
  người dùng chọn, hoàn toàn on-device; không có khả năng dịch → hiển thị nguyên bản + lý do.
- **FR-009**: Khi năng lực xử lý không theo kịp, hệ thống MUST hy sinh tần suất phụ đề tạm
  (bỏ nhịp) chứ KHÔNG được mất câu chốt, và độ trễ không được tích lũy theo thời gian.

**Tóm tắt**

- **FR-010**: Hệ thống MUST tự động tạo tóm tắt điểm chính và danh sách việc cần làm sau khi
  dừng ghi, từ transcript của phiên; bộ tóm tắt chính không khả dụng/quá thời hạn → dùng
  phương án dự phòng on-device.

**Thư viện & quyền sở hữu dữ liệu**

- **FR-011**: Hệ thống MUST lưu mỗi phiên gồm: tiêu đề (sửa được), thời điểm, thời lượng,
  audio nghe lại được, transcript song ngữ có timestamp + nhãn người nói, tóm tắt, trạng thái.
- **FR-012**: Người dùng MUST xuất được biên bản (Markdown, JSON) và file audio; MUST xóa
  vĩnh viễn được một phiên (xóa cả audio lẫn dữ liệu chữ).
- **FR-013**: Người dùng MUST chạy lại được phiên âm từ audio đã lưu bằng cấu hình chất lượng
  cao hơn; nhãn người nói giữ nguyên; tóm tắt tính lại.

**Bảo mật & local-first (Constitution I)**

- **FR-014**: Toàn bộ audio, transcript, bản dịch, tóm tắt, metadata MUST được xử lý và lưu
  trên máy người dùng; hệ thống MUST KHÔNG gửi bất kỳ dữ liệu người dùng nào ra ngoài, kể cả
  telemetry. Network duy nhất được phép: tải model nhận dạng một lần (có cache).
- **FR-015**: Sau lần tải model đầu tiên, mọi chức năng MUST hoạt động offline hoàn toàn.

**Độ bền & vận hành (gap v0.1)**

- **FR-016**: Hệ thống MUST bảo toàn phần đã ghi (audio + transcript) khi tiến trình bị chấm
  dứt đột ngột, mất tối đa một khoảng đệm ngắn (xem SC-006); phiên gián đoạn được đánh dấu
  trong thư viện.
- **FR-017**: Hệ thống MUST hỗ trợ phiên ghi và phiên âm lại dài tới 3 giờ mà không cạn tài
  nguyên; tiến độ phiên âm lại hiển thị cho người dùng.
- **FR-018**: Lần chuẩn bị model đầu tiên MUST hiển thị tiến độ (%); các lần sau MUST không
  tải lại.
- **FR-019**: Hệ thống MUST hiển thị mức sử dụng lưu trữ và cảnh báo khi sắp hết chỗ, kèm
  hành động gợi ý (xóa/xuất phiên cũ); MUST không âm thầm hỏng khi hết chỗ giữa phiên ghi.
- **FR-020**: Tab họp đóng đột ngột khi đang ghi MUST được xử lý như thao tác dừng hợp lệ.

### Key Entities

- **Phiên họp (Meeting)**: một lần ghi — tiêu đề, thời điểm bắt đầu/kết thúc, thời lượng,
  trạng thái (đang ghi / đang xử lý / hoàn tất / lỗi / gián đoạn), ngôn ngữ nguồn/đích,
  tập hợp Câu thoại, Tóm tắt, tham chiếu Bản ghi âm.
- **Câu thoại (Segment)**: khoảng thời gian [t0, t1], nhãn người nói (Bạn/Đối phương/Cả hai),
  văn bản gốc, văn bản dịch (tùy chọn).
- **Bản ghi âm (Recording)**: dữ liệu âm thanh nghe lại được của phiên, gắn 1-1 với Phiên họp.
- **Tóm tắt (Summary)**: các điểm chính, điểm chính đã dịch (tùy chọn), việc cần làm,
  phương pháp tạo (chính / dự phòng).
- **Cài đặt (Settings)**: ngôn ngữ nguồn/đích, lựa chọn chất lượng nhận dạng, tùy chọn cửa sổ
  phụ đề — dùng chung cho mọi phiên (một pipeline, Constitution V).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Trên máy phổ thông hiện đại với cấu hình mặc định, phụ đề tạm xuất hiện trong
  ≤2 giây kể từ lời nói, đo trong phiên thử ≥10 phút.
- **SC-002**: 100% câu chốt của phiên xuất hiện trong transcript cuối (không mất câu khi máy
  quá tải), kiểm chứng bằng phiên thử với inference bị làm chậm nhân tạo.
- **SC-003**: Không có bất kỳ request mạng nào chứa dữ liệu người dùng trong toàn bộ vòng đời
  phiên (ghi → phụ đề → tóm tắt → lưu → xuất), kiểm chứng bằng giám sát network; sau lần tải
  model đầu, toàn bộ luồng chạy được với network bị ngắt.
- **SC-004**: Từ lúc bấm dừng đến lúc mục thư viện sẵn sàng (có tóm tắt): ≤60 giây cho phiên
  60 phút trên máy chuẩn.
- **SC-005**: Người dùng mới hoàn thành được chu trình đầu tiên (cấp quyền → ghi → dừng → xem
  kết quả) trong ≤5 phút kể cả thời gian tải model, với chỉ dẫn trên màn hình.
- **SC-006**: Khi tiến trình bị kill giữa phiên, phần dữ liệu mất tối đa 10 giây cuối; phần
  còn lại nghe/đọc lại được bình thường.
- **SC-007**: Phiên 3 giờ ghi và phiên âm lại thành công trên máy chuẩn 8GB RAM.
- **SC-008**: Nhãn người nói đúng ≥90% số câu trong phiên thử hai người nói luân phiên.

## Assumptions

- Người dùng họp qua ứng dụng web trong trình duyệt Chrome desktop phiên bản gần đây; ứng
  dụng họp native (Zoom app, Teams app) nằm ngoài phạm vi baseline này.
- "Máy chuẩn/hiện đại" = laptop phổ thông đời ≤4 năm, ≥8GB RAM.
- Khả năng dịch và tóm tắt on-device phụ thuộc phiên bản trình duyệt; khi thiếu, sản phẩm
  degrade theo FR-008/FR-010 thay vì chặn sử dụng.
- Phân biệt người nói chỉ cần 2 lớp (Bạn/Đối phương) + "Cả hai"; nhận diện từng cá nhân phía
  đối phương (diarization nhiều người) nằm ngoài phạm vi baseline.
- Gói tính phí/paywall nằm ngoài phạm vi spec này (sẽ là spec riêng khi thương mại hóa).
- Một người dùng, một máy; đồng bộ đa thiết bị mâu thuẫn với local-first và nằm ngoài phạm vi.
