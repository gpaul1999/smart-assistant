# Quickstart — kiểm chứng 003-interview-copilot

## Gate tự động

```bash
npm test          # + retrieval BM25 (vi + xuyên ngôn ngữ + ngưỡng im lặng), question/pairQA,
                  #   prompter grounding (SC-016: không citation → từ chối), db v3 docsets
npm run test:e2e  # + docs page CRUD, answer-card render, gate Pro nút rà soát
```

## Kịch bản thủ công (máy thật, Chrome 138+, license dev)

- **N. Thẻ trả lời live (SC-014/015)**: tạo docset + dán hợp đồng/spec dài; chọn docset
  trong popup (Pro); ghi trên tab phát câu hỏi chạm tài liệu → trích đoạn ≤1.5s sau câu
  chốt, câu đề xuất kèm [n] theo sau ≤5s; câu hỏi ngoài tài liệu → không có thẻ.
- **O. Grounding (SC-016)**: 10 câu hỏi ngoài tài liệu → 0 thẻ có nội dung bịa.
- **P. Rà soát (SC-018)**: sau phiên phỏng vấn thử, bấm "Rà soát phỏng vấn" → báo cáo
  từng câu hỏi KHOP/LECH/THIEU kèm căn cứ; nằm trong export Markdown.
- **Q. Độ trễ (SC-017)**: bật Copilot, đo lại phụ đề tạm — vẫn ≤2s.
- **R. Local (SC-019)**: giám sát network toàn luồng Copilot → 0 request.

## Kết quả kiểm chứng

| Ngày | Hạng mục | Kết quả |
|---|---|---|
| 2026-07-06 | Gate tự động | ✅ 64 unit + 19 E2E xanh |
| — | N/O/P/Q/R thủ công | ⏳ chờ chủ dự án (cần Gemini Nano + license dev trên máy thật) |
