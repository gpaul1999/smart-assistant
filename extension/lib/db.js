// IndexedDB wrapper — toàn bộ dữ liệu cuộc họp nằm local trong trình duyệt.
// Store 'meetings': metadata + transcript + summary. Store 'audio': blob ghi âm (tách riêng
// để listMeetings không phải load blob nặng). Store 'audio_chunks' (v2): chunk 5s đang ghi,
// persist ngay để sống sót crash (spec 001 FR-016); dọn sau khi phiên chốt thành công.
const DB_NAME = 'smart-assistant';
const DB_VERSION = 3;

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
      // v3 (spec 003): kho tài liệu tham chiếu cho Copilot
      if (!db.objectStoreNames.contains('docsets')) {
        db.createObjectStore('docsets', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('docs')) {
        db.createObjectStore('docs', { keyPath: 'id' });
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

// ---- kho tài liệu Copilot (spec 003 FR-031) ----

export function putDocSet(docset) {
  return withStore('docsets', 'readwrite', (s) => req(s.put(docset)));
}

export async function listDocSets() {
  const all = await withStore('docsets', 'readonly', (s) => req(s.getAll()));
  return all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function putDoc(doc) {
  return withStore('docs', 'readwrite', (s) => req(s.put(doc)));
}

export async function listDocs(docsetId) {
  const all = await withStore('docs', 'readonly', (s) => req(s.getAll()));
  return all.filter((d) => d.docsetId === docsetId);
}

export function deleteDoc(id) {
  return withStore('docs', 'readwrite', (s) => req(s.delete(id)));
}

/** Xóa docset + toàn bộ docs thuộc nó (xóa là xóa thật — FR-031). */
export async function deleteDocSet(id) {
  await withStore('docsets', 'readwrite', (s) => req(s.delete(id)));
  for (const d of await listDocs(id)) await deleteDoc(d.id);
}
