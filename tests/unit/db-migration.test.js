// Migration v1 → v2: mở db schema cũ trước, rồi mở qua lib (v2) — dữ liệu cũ phải còn nguyên
// và store mới audio_chunks phải xuất hiện. Chạy ở file riêng để process này thấy db v1 trước.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

function openV1() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('smart-assistant', 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      db.createObjectStore('meetings', { keyPath: 'id' });
      db.createObjectStore('audio', { keyPath: 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

test('nâng cấp v1 → v2 giữ nguyên meetings, thêm audio_chunks', async () => {
  const v1 = await openV1();
  await new Promise((resolve, reject) => {
    const t = v1.transaction('meetings', 'readwrite');
    t.objectStore('meetings').put({ id: 'legacy', title: 'Cũ', status: 'done', startedAt: 5 });
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
  v1.close();

  const { getMeeting, putAudioChunk, getAudioChunks } = await import('../../extension/lib/db.js');
  const m = await getMeeting('legacy');
  assert.equal(m.title, 'Cũ', 'dữ liệu v1 còn nguyên sau migration');

  await putAudioChunk('legacy', 0, new Blob(['ok']));
  assert.equal((await getAudioChunks('legacy')).length, 1, 'store mới hoạt động');
});
