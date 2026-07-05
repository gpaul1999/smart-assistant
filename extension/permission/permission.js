const status = document.getElementById('status');

document.getElementById('grant').addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const t of stream.getTracks()) t.stop();
    status.className = 'ok';
    status.textContent = '✔ Đã cấp quyền! Bạn có thể đóng tab này và bắt đầu ghi âm.';
  } catch (e) {
    status.className = 'err';
    status.textContent =
      'Không cấp được quyền: ' + e.message + ' — hãy kiểm tra cài đặt Site settings của Chrome.';
  }
});
