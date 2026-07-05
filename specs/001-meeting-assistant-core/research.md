# Research — 001-meeting-assistant-core (Phase 0)

Các quyết định kỹ thuật cho phần gap của spec. Không còn NEEDS CLARIFICATION.

## R1. Crash-safe recording (FR-016, SC-006)

**Decision**: Persist từng chunk MediaRecorder (timeslice 5s) vào IndexedDB store
`audio_chunks` ngay khi `ondataavailable` bắn; transcript vốn đã persist dần theo từng câu
chốt (v0.1). Khi extension khởi động (service worker `onStartup`/`onInstalled` + lần mở
viewer), quét meeting có status `recording` mồ côi → ghép các chunk theo thứ tự thành blob,
lưu vào store `audio`, đổi status thành `interrupted`, xóa chunks. Sau khi phiên dừng bình
thường, chunks cũng được dọn.

**Rationale**: Chuỗi chunk WebM từ MediaRecorder ghép từ chunk đầu tiên là một **stream
prefix hợp lệ** — trình duyệt phát được file bị cụt đuôi. Timeslice 5s ⇒ mất tối đa 5s + độ
trễ ghi IDB < 10s, thỏa SC-006. Ghi IDB bất đồng bộ ngoài audio thread nên không ảnh hưởng
độ trễ phụ đề (Constitution VI).

**Alternatives considered**:
- *Giữ chunk trong RAM, chỉ lưu khi dừng (v0.1)*: mất trắng audio khi crash — chính là gap.
- *Ghi File System Access API*: cần permission picker mỗi phiên, phá UX một-nút.
- *Rotate nhiều file MediaRecorder 10 phút*: từng part phát độc lập được nhưng playback
  nhiều part cần MediaSource/nối seekbar — phức tạp hơn hẳn mà không cần thiết khi prefix
  WebM đã phát được.

## R2. Phiên 3 giờ — re-transcribe streaming (FR-017, SC-007)

**Decision**: Viết `extension/lib/webm-opus.js` — demuxer EBML/WebM tối giản (chỉ đọc
SimpleBlock/Block chứa Opus packet + timestamp) → nạp packet vào **WebCodecs
`AudioDecoder`** (codec `opus`) → gom PCM, downsample 48k→16k → đẩy vào Whisper theo cửa sổ
10 phút (chồng lấn 5s để không mất chữ ở biên), giải phóng buffer sau mỗi cửa sổ. Fallback:
file < 30 phút hoặc không có WebCodecs → `decodeAudioData` toàn bộ như v0.1.

**Rationale**: PCM 16k mono của 3h ≈ 690MB float32 — `decodeAudioData` toàn bộ (kèm đỉnh
decode 48k stereo ≈ 4GB) chắc chắn OOM trên máy 8GB. Streaming decode giữ đỉnh RAM ≈ 1 cửa
sổ (10' ≈ 38MB PCM) + model. Demuxer chỉ cần đường đi hẹp (WebM do chính MediaRecorder của
Chrome sinh ra — cấu trúc ổn định), ~200 dòng, thuần JS test được bằng Node với fixture nhị
phân nhỏ.

**Alternatives considered**:
- *Thư viện demuxer (libav.js, web-demuxer, jswebm)*: kéo WASM/dep lớn bên thứ ba — vi phạm
  tinh thần Constitution II và tăng bề mặt supply-chain phải audit local-first.
- *Ghi PCM thô khi record để khỏi demux*: 3h PCM 16k = 690MB/phiên trong IDB — phá SC về
  dung lượng, quota cạn nhanh gấp ~15 lần so với Opus.
- *Decode qua `<audio>` + MediaElementSource realtime*: mất 3h thật để xử lý phiên 3h.

## R3. UX tải model lần đầu (FR-018, SC-005)

**Decision**: Tận dụng `progress_callback` sẵn có của transformers.js (đã broadcast
`model-progress` từ v0.1) — hiển thị % ở popup (khi bắt đầu ghi), cửa sổ phụ đề (đã có,
hoàn thiện) và viewer (khi re-transcribe). Thêm nút "Chuẩn bị model trước" trong popup để
tải trước khi vào họp. Model cache bằng Cache API (mặc định transformers.js) — lần sau
không tải lại (FR-018, FR-015).

**Rationale**: Không cần cơ chế mới, chỉ nối progress đã có vào UI; nút tải trước loại bỏ
tình huống "vào phỏng vấn rồi mới chờ 40–150MB".

**Alternatives considered**: đóng gói model vào extension (tăng size store lên trăm MB,
không cho chọn model) — loại.

## R4. Quản lý dung lượng (FR-019)

**Decision**: `extension/lib/storage-policy.js` (thuần): nhận `{usage, quota}` (từ
`navigator.storage.estimate()` do UI truyền vào) → trả mức cảnh báo (`ok` <70%, `warn`
70–90%, `critical` >90%) + ước lượng "còn ghi được ~X giờ" (dựa 30MB/giờ Opus 64kbps).
Popup chặn bắt đầu ghi khi `critical` (kèm hướng dẫn dọn); viewer hiển thị quota bar +
dung lượng từng phiên. Gọi `navigator.storage.persist()` một lần để chống trình duyệt tự
dọn IndexedDB.

**Rationale**: `estimate()` là API chuẩn, local; policy tách thuần để unit test ngưỡng.

**Alternatives considered**: tự động xóa phiên cũ (LRU) — nguy hiểm với dữ liệu người dùng,
để họ tự quyết (chỉ gợi ý).

## R5. Tab đóng đột ngột (FR-020)

**Decision**: Trong offscreen, lắng nghe `track.onended` / `stream.oninactive` của tab
stream → gọi đúng luồng `stopRecording()` hiện có (chốt câu dở, lưu audio, tóm tắt).

**Rationale**: tabCapture track kết thúc là tín hiệu chuẩn khi tab đóng; tái dùng luồng
dừng bình thường nên không tạo nhánh code mới.

**Alternatives considered**: theo dõi `chrome.tabs.onRemoved` ở background — cũng làm được
nhưng phải giữ tabId map; tín hiệu track ended đơn giản và đúng tầng hơn.

## R6. Đo chất lượng nhãn người nói (SC-008)

**Decision**: Harness unit-test: sinh fixture PCM hai kênh (mic/tab) mô phỏng hội thoại
luân phiên (xen kẽ khoảng nói có năng lượng lệch nhau + khoảng chồng lấn) với ground-truth
nhãn; chạy qua `Segmenter` + logic gán nhãn (tách hàm `labelSpeaker(rmsMic, rmsTab)` từ
offscreen về `lib/segmenter.js`); assert accuracy ≥90% trên fixture, in confusion count.

**Rationale**: Đo bằng audio thật cần tai người; fixture tổng hợp đo được tự động, chạy
trong CI, đủ để chặn regression của heuristic RMS (ngưỡng 1.4×).

**Alternatives considered**: E2E với file audio thật — không có ground-truth máy chấm được,
flaky; đo thủ công định kỳ — không chặn được regression.
