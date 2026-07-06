// Helper thuần (không phụ thuộc chrome.*) — dùng chung cho UI, offscreen và unit test.

export function uid() {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** giây (số thực) → "hh:mm:ss" hoặc "mm:ss" */
export function secToClock(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function fmtDate(ts, locale = 'vi-VN') {
  if (!ts) return '';
  return new Date(ts).toLocaleString(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export const SPEAKER_LABELS = { me: 'Bạn', them: 'Đối phương', both: 'Cả hai' };

/** Xuất meeting thành Markdown (transcript + dịch + tóm tắt). */
export function buildMarkdown(meeting) {
  const lines = [];
  lines.push(`# ${meeting.title || 'Cuộc họp'}`);
  lines.push('');
  lines.push(`- **Thời gian**: ${fmtDate(meeting.startedAt)}`);
  if (meeting.durationMs) lines.push(`- **Thời lượng**: ${secToClock(meeting.durationMs / 1000)}`);
  lines.push('');

  const sum = meeting.summary;
  if (sum && (sum.keyPoints?.length || sum.actionItems?.length)) {
    lines.push('## Tóm tắt điểm chính');
    lines.push('');
    for (const p of sum.keyPoints || []) lines.push(`- ${p}`);
    if (sum.keyPointsTranslated?.length) {
      lines.push('');
      lines.push(`### Bản dịch (${meeting.targetLang || ''})`);
      lines.push('');
      for (const p of sum.keyPointsTranslated) lines.push(`- ${p}`);
    }
    if (sum.actionItems?.length) {
      lines.push('');
      lines.push('## Việc cần làm (action items)');
      lines.push('');
      for (const a of sum.actionItems) lines.push(`- [ ] ${a}`);
    }
    lines.push('');
  }

  if (meeting.review?.length) {
    lines.push('## Rà soát theo tài liệu');
    lines.push('');
    for (const r of meeting.review) {
      lines.push(`### ❓ ${r.question}`);
      lines.push('');
      lines.push(`- **Bạn trả lời**: ${r.answerText || '(không trả lời)'}`);
      lines.push(`- **Đối chiếu**: ${r.verdict}`);
      lines.push('');
    }
  }

  if (meeting.segments?.length) {
    lines.push('## Transcript');
    lines.push('');
    for (const seg of meeting.segments) {
      const t = `[${secToClock(seg.t0)}]`;
      const who = seg.speaker ? ` **${SPEAKER_LABELS[seg.speaker] || seg.speaker}:**` : '';
      lines.push(`- ${t}${who} ${seg.text}`);
      if (seg.translation) lines.push(`  - _${seg.translation}_`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
