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

test('deleteMeeting xóa cả meeting lẫn audio', async () => {
  await deleteMeeting('a');
  assert.equal(await getMeeting('a'), undefined);
  assert.equal(await getAudio('a'), undefined);
});
