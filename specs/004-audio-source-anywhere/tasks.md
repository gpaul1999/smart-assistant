# Tasks: Nguồn âm mọi nơi (004)

- [x] T301 `lib/source-mode.js` (thuần): năng lực từng chế độ {needsTab, needsPicker,
      hasSeparation, passthrough} + unit test (SC-023)
- [x] T302 Manifest: +permission `desktopCapture`; version 0.5.0
- [x] T303 Popup: selector nguồn âm (FR-039), validate theo chế độ, nhớ lựa chọn
- [x] T304 Background: route theo mode — tab: getMediaStreamId; system:
      desktopCapture.chooseDesktopMedia(['screen','window','audio']); mic: không streamId;
      setupCaptions ép cửa sổ riêng khi mode ≠ tab (FR-043)
- [x] T305 Offscreen: nguồn "đối phương" theo mode (desktop getUserMedia + bỏ video track,
      không passthrough — FR-040; mic-only: EC/NS off, speaker=null — FR-041); track ended
      → stop (FR-042); lưu sourceMode vào meeting; Copilot bắt câu hỏi mọi segment khi
      mode=mic
- [x] T306 E2E: popup selector 3 chế độ + persist; unit source-mode; gate xanh
- [x] T307 Docs: DEVLOG/README/quickstart 004 + commit/push
