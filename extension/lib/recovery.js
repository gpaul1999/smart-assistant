// Khôi phục phiên ghi bị gián đoạn (crash/kill giữa chừng) — spec 001 FR-016.
// Thuần ES module, mọi phụ thuộc DB được tiêm qua tham số → unit test bằng Node.

/**
 * Ghép các chunk thành blob audio phát được. Chuỗi WebM từ MediaRecorder ghép từ chunk 0
 * là stream prefix hợp lệ; seq phải liên tục từ 0 — gặp lỗ hổng thì cắt tại đó.
 * @param {Array<{seq: number, data: Blob}>} chunks (bất kỳ thứ tự)
 * @returns {{blob: Blob, count: number} | null} null nếu không có chunk 0
 */
export function assembleChunks(chunks) {
  const sorted = [...chunks].sort((a, b) => a.seq - b.seq);
  const prefix = [];
  for (let expect = 0; expect < sorted.length; expect++) {
    if (sorted[expect]?.seq !== expect) break;
    prefix.push(sorted[expect].data);
  }
  if (!prefix.length) return null;
  return { blob: new Blob(prefix, { type: 'audio/webm' }), count: prefix.length };
}

/**
 * Quét meeting còn status 'recording' không thuộc phiên đang hoạt động → ghép audio từ
 * chunks, đánh dấu 'interrupted', dọn chunks. Idempotent — chạy lại không gây hại.
 *
 * @param {object} db — { listRecordingMeetings, getAudioChunks, saveAudio,
 *                        deleteAudioChunks, patchMeeting }
 * @param {{activeMeetingId?: string|null}} [opts]
 * @returns {Promise<string[]>} id các meeting đã khôi phục
 */
export async function recoverInterrupted(db, { activeMeetingId = null } = {}) {
  const recovered = [];
  for (const meeting of await db.listRecordingMeetings()) {
    if (meeting.id === activeMeetingId) continue; // phiên đang ghi thật

    const chunks = await db.getAudioChunks(meeting.id);
    const assembled = assembleChunks(chunks);
    if (assembled) {
      await db.saveAudio(meeting.id, assembled.blob, 'audio/webm');
    }

    // Ước lượng thời lượng: câu chốt cuối (đã persist dần) hoặc số chunk × 5s
    const lastSegEnd = meeting.segments?.length
      ? meeting.segments[meeting.segments.length - 1].t1 * 1000
      : 0;
    const durationMs = Math.max(lastSegEnd, (assembled?.count || 0) * 5000);

    await db.patchMeeting(meeting.id, {
      status: 'interrupted',
      durationMs: durationMs || meeting.durationMs || 0,
      audioBytes: assembled?.blob.size || 0,
    });
    await db.deleteAudioChunks(meeting.id);
    recovered.push(meeting.id);
  }
  return recovered;
}
