// IndexedDB wrapper — toàn bộ dữ liệu cuộc họp nằm local trong trình duyệt.
// Store 'meetings': metadata + transcript + summary. Store 'audio': blob ghi âm (tách riêng
// để listMeetings không phải load blob nặng). Store 'audio_chunks' (v2): chunk 5s đang ghi,
// persist ngay để sống sót crash (spec 001 FR-016); dọn sau khi phiên chốt thành công.
const DB_NAME = 'smart-assistant';
const DB_VERSION = 2;

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function openDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('meetings')) {
        db.createObjectStore('meetings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('audio')) {
        db.createObjectStore('audio', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('audio_chunks')) {
        db.createObjectStore('audio_chunks', { keyPath: ['meetingId', 'seq'] });
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function withStore(name, mode, fn) {
  const db = await openDb();
  try {
    const store = db.transaction(name, mode).objectStore(name);
    return await fn(store);
  } finally {
    db.close();
  }
}

export function putMeeting(meeting) {
  return withStore('meetings', 'readwrite', (s) => req(s.put(meeting)));
}

export function getMeeting(id) {
  return withStore('meetings', 'readonly', (s) => req(s.get(id)));
}

/** Trả về meetings mới nhất trước, KHÔNG kèm audio blob. */
export async function listMeetings() {
  const all = await withStore('meetings', 'readonly', (s) => req(s.getAll()));
  return all.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
}

/** Merge patch vào meeting hiện có (tạo mới nếu chưa có). */
export async function patchMeeting(id, patch) {
  const cur = (await getMeeting(id)) || { id };
  const next = { ...cur, ...patch, id };
  await putMeeting(next);
  return next;
}

export async function deleteMeeting(id) {
  await withStore('meetings', 'readwrite', (s) => req(s.delete(id)));
  await withStore('audio', 'readwrite', (s) => req(s.delete(id)));
  await deleteAudioChunks(id);
}

export function saveAudio(id, blob, mimeType) {
  return withStore('audio', 'readwrite', (s) => req(s.put({ id, blob, mimeType })));
}

export function getAudio(id) {
  return withStore('audio', 'readonly', (s) => req(s.get(id)));
}

// ---- audio_chunks (crash-safe recording, spec 001 FR-016) ----

export function putAudioChunk(meetingId, seq, data) {
  return withStore('audio_chunks', 'readwrite', (s) => req(s.put({ meetingId, seq, data })));
}

/** Chunks của một meeting, sắp theo seq tăng dần. */
export async function getAudioChunks(meetingId) {
  const range = IDBKeyRange.bound([meetingId, 0], [meetingId, Infinity]);
  const rows = await withStore('audio_chunks', 'readonly', (s) => req(s.getAll(range)));
  return rows.sort((a, b) => a.seq - b.seq);
}

export function deleteAudioChunks(meetingId) {
  const range = IDBKeyRange.bound([meetingId, 0], [meetingId, Infinity]);
  return withStore('audio_chunks', 'readwrite', (s) => req(s.delete(range)));
}

/** Meetings còn status 'recording' — ứng viên cho recovery sau crash. */
export async function listRecordingMeetings() {
  const all = await withStore('meetings', 'readonly', (s) => req(s.getAll()));
  return all.filter((m) => m.status === 'recording');
}
