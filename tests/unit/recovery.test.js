import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { assembleChunks, recoverInterrupted } from '../../extension/lib/recovery.js';
import * as db from '../../extension/lib/db.js';

test('assembleChunks ghép đúng thứ tự seq', async () => {
  const out = assembleChunks([
    { seq: 2, data: new Blob(['c']) },
    { seq: 0, data: new Blob(['a']) },
    { seq: 1, data: new Blob(['b']) },
  ]);
  assert.equal(out.count, 3);
  assert.equal(await out.blob.text(), 'abc');
});

test('assembleChunks cắt prefix khi seq thiếu giữa chừng', async () => {
  const out = assembleChunks([
    { seq: 0, data: new Blob(['a']) },
    { seq: 1, data: new Blob(['b']) },
    { seq: 3, data: new Blob(['d']) }, // thiếu seq 2
  ]);
  assert.equal(out.count, 2);
  assert.equal(await out.blob.text(), 'ab');
});

test('assembleChunks trả null khi không có chunk 0', () => {
  assert.equal(assembleChunks([{ seq: 1, data: new Blob(['b']) }]), null);
  assert.equal(assembleChunks([]), null);
});

test('recoverInterrupted: meeting recording mồ côi → interrupted, audio ghép, chunks dọn', async () => {
  await db.putMeeting({
    id: 'crash1',
    status: 'recording',
    startedAt: 1000,
    segments: [{ t0: 0, t1: 12.5, speaker: 'me', text: 'xin chào' }],
  });
  await db.putAudioChunk('crash1', 0, new Blob(['aaaa']));
  await db.putAudioChunk('crash1', 1, new Blob(['bbbb']));

  const recovered = await recoverInterrupted(db);
  assert.deepEqual(recovered, ['crash1']);

  const m = await db.getMeeting('crash1');
  assert.equal(m.status, 'interrupted');
  assert.equal(m.durationMs, 12500, 'thời lượng theo câu chốt cuối (12.5s > 2 chunk × 5s)');
  assert.equal(m.audioBytes, 8);
  assert.equal(await (await db.getAudio('crash1')).blob.text(), 'aaaabbbb');
  assert.equal((await db.getAudioChunks('crash1')).length, 0, 'chunks đã dọn');

  await db.deleteMeeting('crash1');
});

test('recoverInterrupted: bỏ qua phiên đang hoạt động', async () => {
  await db.putMeeting({ id: 'live1', status: 'recording', startedAt: 1 });
  const recovered = await recoverInterrupted(db, { activeMeetingId: 'live1' });
  assert.deepEqual(recovered, []);
  assert.equal((await db.getMeeting('live1')).status, 'recording');
  await db.deleteMeeting('live1');
});

test('recoverInterrupted: không có chunk nào vẫn đánh dấu interrupted (transcript còn)', async () => {
  await db.putMeeting({ id: 'crash2', status: 'recording', startedAt: 1, segments: [] });
  const recovered = await recoverInterrupted(db);
  assert.deepEqual(recovered, ['crash2']);
  const m = await db.getMeeting('crash2');
  assert.equal(m.status, 'interrupted');
  assert.equal(await db.getAudio('crash2'), undefined, 'không có audio giả');
  await db.deleteMeeting('crash2');
});

test('recoverInterrupted idempotent — chạy lần hai không đổi gì', async () => {
  await db.putMeeting({ id: 'crash3', status: 'recording', startedAt: 1 });
  await recoverInterrupted(db);
  const again = await recoverInterrupted(db);
  assert.deepEqual(again, [], 'interrupted không còn là recording');
  await db.deleteMeeting('crash3');
});
