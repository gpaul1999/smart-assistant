# Implementation Plan: Copilot trả lời từ tài liệu (Pro)

**Spec**: [spec.md](spec.md) | **Date**: 2026-07-06

## Summary

Kho tài liệu local (IndexedDB v3) → chunk + truy hồi BM25 thuần JS → khi câu hỏi của
"Đối phương" được chốt: thẻ trả lời 2 tầng (trích đoạn ≤1.5s; câu đề xuất grounded từ
Gemini Nano/Prompt API ≤5s, 0 bịa) trên overlay/cửa sổ live → rà soát sau buổi trong viewer.

## Technical Context

Như 001/002 + **Prompt API (`LanguageModel`, Gemini Nano on-device, Chrome ≥138)**.
Không dependency mới. IndexedDB v3: stores `docsets`, `docs` (chunks precompute khi lưu).

## Constitution Check — PASS

| | |
|---|---|
| I Local-first | ✅ Prompt API on-device; kho tài liệu trong IndexedDB; 0 network |
| II Simplicity | ✅ BM25 tự viết (~100 dòng) thay vì vector DB; chưa cần embeddings |
| III Lib thuần | ✅ `lib/retrieval.js`, `lib/question.js`, `lib/prompter.js` (prompt build/parse thuần; phần gọi LanguageModel guard `globalThis`) |
| IV Test | ✅ unit retrieval/question/prompter/db-v3; E2E docs page + answer card + gate Pro |
| V Một pipeline | ✅ Copilot là consumer của live-segment; tắt/bật không đổi pipeline |
| VI Hiệu năng | ✅ Nano chạy runtime riêng, không tranh mutex Whisper; retrieval O(ms) |

## Design quyết định chính

- **R1 Retrieval**: chunk ~1200 ký tự/chồng lấn 200; BM25 (k1=1.5, b=0.75) trên token
  unicode lowercase; **xuyên ngôn ngữ** bằng cách query = câu hỏi gốc + bản dịch (đã có
  sẵn từ pipeline); ngưỡng điểm tối thiểu → im lặng thay vì nhiễu (FR-034).
- **R2 Grounding**: prompt Nano chỉ chứa trích đoạn đã truy hồi + luật "chỉ dùng trích
  đoạn, thiếu thì trả đúng chuỗi KHONG_DU_CAN_CU"; parse chặt; mọi output kèm chỉ số
  trích đoạn nguồn [1][2]. Không có Nano → dừng ở tầng trích đoạn (vẫn hữu dụng).
- **R3 Q&A pairing cho rà soát**: câu hỏi = segment `them` là câu hỏi; câu trả lời = các
  segment `me`/`both` liền sau cho tới câu hỏi kế (thuần, test được).
- **R4 Phạm vi đợt này**: US1+US2 (P1) + US3 review (P2) đầy đủ; **US4 mock interview
  (P3) DEFER** — ghi vào tasks, chờ tín hiệu người dùng thật (đúng D1).

## Structure

```text
extension/lib/{retrieval,question,prompter}.js   # thuần + unit tests
extension/lib/db.js                              # v3: docsets, docs
extension/docs/docs.{html,js,css}                # quản lý kho tài liệu (Pro)
extension/offscreen/offscreen.js                 # copilot flow: question → retrieve → card → synth
extension/background.js                          # cấu hình copilot vào offscreen-start; relay answer-card
extension/content/overlay.js + live/live.js      # render AnswerCard
extension/viewer/viewer.js                       # nút "Rà soát phỏng vấn" (Pro) + render review
extension/popup/popup.html|js                    # chọn bộ tài liệu cho phiên (Pro)
```
