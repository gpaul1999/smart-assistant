# Tasks: Copilot trả lời từ tài liệu (003)

- [x] T201 DB v3: stores `docsets`, `docs` + API CRUD + migration test
- [x] T202 [P] `lib/retrieval.js`: chunkText + BM25 index/search xuyên ngôn ngữ + ngưỡng
      im lặng + unit tests
- [x] T203 [P] `lib/question.js`: phát hiện câu hỏi vi/en + unit tests
- [x] T204 [P] `lib/prompter.js`: buildAnswerPrompt/parseAnswer (thuần) + wrapper
      LanguageModel guard + unit tests phần thuần
- [x] T205 `extension/docs/`: trang quản lý kho tài liệu (docset CRUD, dán văn bản,
      đếm chunk) — Pro gate
- [x] T206 Popup: select bộ tài liệu cho phiên (Pro) + link trang docs
- [x] T207 Offscreen: copilot flow trên câu chốt `them` → retrieve → broadcast
      `answer-card` (excerpts) → Nano synth grounded → update card; gate Pro + docset
- [x] T208 Background: đưa copilot cfg vào offscreen-start; relay `answer-card` tới overlay
- [x] T209 Overlay + live window: render AnswerCard (thu gọn được, kèm nguồn)
- [x] T210 Viewer: nút "Rà soát phỏng vấn" (Pro) → pairing Q&A (lib thuần) + đối chiếu
      tài liệu qua prompter → lưu `meeting.review` + render + trong export Markdown
- [x] T211 E2E: docs page CRUD; answer-card render trong overlay (hook); gate Pro
- [x] T212 Docs (README/DEVLOG/contracts) + full gate + quickstart results
- [ ] T213 **DEFERRED** US4 mock interview (P3) — chờ tín hiệu demand (D1)
