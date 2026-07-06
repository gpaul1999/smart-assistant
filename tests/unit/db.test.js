import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {
  putMeeting,
  getMeeting,
  listMeetings,
  patchMeeting,
  deleteMeeting,
  saveAudio,
  getAudio,
  putAudioChunk,
  getAudioChunks,
  deleteAudioChunks,
  listRecordingMeetings,
} from '../../extension/lib/db.js';

before(async () => {
  // dọn dữ liệu giữa các lần chạy
  for (const m of await listMeetings()) await deleteMeeting(m.id);
});

test('put/get meeting round-trip', async () => {
  await putMeeting({ id: 'a', title: 'Họp A', startedAt: 100, status: 'done' });
  const m = await getMeeting('a');
  assert.equal(m.title, 'Họp A');
});

test('listMeetings sắp xếp mới nhất trước', async () => {
  await putMeeting({ id: 'b', title: 'Họp B', startedAt: 300 });
  await putMeeting({ id: 'c', title: 'Họp C', startedAt: 200 });
  const list = await listMeetings();
  const ids = list.map((m) => m.id);
  assert.deepEqual(ids.slice(0, 3), ['b', 'c', 'a']);
});

test('patchMeeting merge không mất field cũ', async () => {
  await patchMeeting('a', { status: 'summarizing' });
  const m = await getMeeting('a');
  assert.equal(m.status, 'summarizing');
  assert.equal(m.title, 'Họp A');
});

test('patchMeeting tạo mới nếu chưa tồn tại', async () => {
  const m = await patchMeeting('new-one', { title: 'Mới' });
  assert.equal(m.id, 'new-one');
  assert.equal((await getMeeting('new-one')).title, 'Mới');
});

test('saveAudio/getAudio round-trip', async () => {
  const blob = new Blob(['xin chào'], { type: 'audio/webm' });
  await saveAudio('a', blob, 'audio/webm');
  const rec = await getAudio('a');
  assert.equal(rec.mimeType, 'audio/webm');
  assert.equal(await rec.blob.text(), 'xin chào');
});

test('audio chunks: put/get theo seq tăng dần, xóa theo meetingId', async () => {
  await putAudioChunk('a', 1, new Blob(['b'])); // cố tình put lệch thứ tự
  await putAudioChunk('a', 0, new Blob(['a']));
  await putAudioChunk('a', 2, new Blob(['c']));
  await putAudioChunk('khac', 0, new Blob(['x']));
  const chunks = await getAudioChunks('a');
  assert.deepEqual(chunks.map((c) => c.seq), [0, 1, 2]);
  assert.equal(await (new Blob(chunks.map((c) => c.data))).text(), 'abc');

  await deleteAudioChunks('a');
  assert.equal((await getAudioChunks('a')).length, 0);
  assert.equal((await getAudioChunks('khac')).length, 1, 'không đụng meeting khác');
});

test('listRecordingMeetings chỉ trả meeting đang recording', async () => {
  await putMeeting({ id: 'rec1', status: 'recording', startedAt: 1 });
  await putMeeting({ id: 'done1', status: 'done', startedAt: 2 });
  const recs = await listRecordingMeetings();
  assert.ok(recs.some((m) => m.id === 'rec1'));
  assert.ok(!recs.some((m) => m.id === 'done1'));
  await deleteMeeting('rec1');
  await deleteMeeting('done1');
});

test('deleteMeeting xóa cả meeting, audio lẫn chunks', async () => {
  await putAudioChunk('a', 0, new Blob(['z']));
  await deleteMeeting('a');
  assert.equal(await getMeeting('a'), undefined);
  assert.equal(await getAudio('a'), undefined);
  assert.equal((await getAudioChunks('a')).length, 0);
});
