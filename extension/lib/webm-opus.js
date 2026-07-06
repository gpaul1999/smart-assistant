// Demuxer WebM → Opus packet, tối giản (spec 001 research R2).
// Chỉ nhắm đường đi hẹp: file WebM do MediaRecorder của Chrome sinh (audio/webm;codecs=opus).
// Thuần JS, không dependency — dùng cho re-transcribe streaming (WebCodecs AudioDecoder)
// để không phải decode cả 3 giờ audio vào RAM. PHẢI chịu được file cụt đuôi
// (chính là audio khôi phục sau crash): gặp EOF giữa chừng → trả về những gì đã parse.

const ID = {
  SEGMENT: 0x18538067,
  INFO: 0x1549a966,
  TIMESTAMP_SCALE: 0x2ad7b1,
  TRACKS: 0x1654ae6b,
  TRACK_ENTRY: 0xae,
  TRACK_NUMBER: 0xd7,
  CODEC_ID: 0x86,
  CODEC_PRIVATE: 0x63a2,
  AUDIO: 0xe1,
  SAMPLING_FREQUENCY: 0xb5,
  CHANNELS: 0x9f,
  CLUSTER: 0x1f43b675,
  CLUSTER_TIMESTAMP: 0xe7,
  SIMPLE_BLOCK: 0xa3,
  BLOCK_GROUP: 0xa0,
  BLOCK: 0xa1,
};

// Container cần đi VÀO trong (không skip theo size)
const DESCEND = new Set([
  ID.SEGMENT, ID.INFO, ID.TRACKS, ID.TRACK_ENTRY, ID.AUDIO, ID.CLUSTER, ID.BLOCK_GROUP,
]);

/** Đọc EBML vint tại pos. keepMarker=true cho element ID, false cho size. */
function readVint(buf, pos, keepMarker) {
  const first = buf[pos];
  if (first === undefined || first === 0) return null;
  let len = 1;
  let mask = 0x80;
  while (!(first & mask)) {
    mask >>= 1;
    len++;
  }
  if (pos + len > buf.length) return null; // cụt đuôi giữa vint
  let value = keepMarker ? first : first & (mask - 1);
  for (let i = 1; i < len; i++) value = value * 256 + buf[pos + i];
  const unknown = !keepMarker && value === 2 ** (7 * len) - 1;
  return { value, len, unknown };
}

function readUint(buf, start, size) {
  let v = 0;
  for (let i = 0; i < size; i++) v = v * 256 + buf[start + i];
  return v;
}

function readFloat(buf, start, size) {
  const dv = new DataView(buf.buffer, buf.byteOffset + start, size);
  return size === 4 ? dv.getFloat32(0) : dv.getFloat64(0);
}

function readAscii(buf, start, size) {
  let s = '';
  for (let i = 0; i < size; i++) s += String.fromCharCode(buf[start + i]);
  return s.replace(/\0+$/, '');
}

/** Parse payload của (Simple)Block → packet Opus. Không hỗ trợ lacing (Chrome không dùng). */
function parseBlock(buf, start, endPos, clusterTs, scaleMs, trackWanted) {
  const tn = readVint(buf, start, false);
  if (!tn) return null;
  let p = start + tn.len;
  if (p + 3 > endPos) return null;
  const rel = (buf[p] << 8) | buf[p + 1];
  const relSigned = rel > 0x7fff ? rel - 0x10000 : rel;
  const flags = buf[p + 2];
  p += 3;
  if ((flags >> 1) & 0x3) return null; // lacing — ngoài đường đi hẹp, bỏ block
  if (trackWanted != null && tn.value !== trackWanted) return null;
  return {
    data: buf.subarray(p, endPos),
    tsMs: (clusterTs + relSigned) * scaleMs,
  };
}

/**
 * @param {Uint8Array} buf — nội dung file WebM (có thể cụt đuôi)
 * @returns {{ timestampScaleNs: number, track: {number: number|null, codecId: string|null,
 *   sampleRate: number, channels: number, codecPrivate: Uint8Array|null},
 *   packets: Array<{data: Uint8Array, tsMs: number}>, durationMs: number, truncated: boolean }}
 */
export function demuxWebmOpus(buf) {
  const out = {
    timestampScaleNs: 1_000_000, // mặc định Matroska: 1ms/đơn vị
    track: { number: null, codecId: null, sampleRate: 48000, channels: 2, codecPrivate: null },
    packets: [],
    durationMs: 0,
    truncated: false,
  };

  let pos = 0;
  let clusterTs = 0;
  let entry = null; // TrackEntry đang đọc

  while (pos < buf.length) {
    const id = readVint(buf, pos, true);
    if (!id) { out.truncated = pos < buf.length; break; }
    const size = readVint(buf, pos + id.len, false);
    if (!size) { out.truncated = true; break; }
    const dataStart = pos + id.len + size.len;
    const dataEnd = size.unknown ? buf.length : dataStart + size.value;

    if (DESCEND.has(id.value) || size.unknown) {
      if (id.value === ID.TRACK_ENTRY) entry = {};
      pos = dataStart; // đi vào trong container
      continue;
    }

    if (dataEnd > buf.length) { out.truncated = true; break; } // leaf cụt đuôi

    const scaleMs = out.timestampScaleNs / 1e6;
    switch (id.value) {
      case ID.TIMESTAMP_SCALE:
        out.timestampScaleNs = readUint(buf, dataStart, size.value);
        break;
      case ID.TRACK_NUMBER:
        if (entry) entry.number = readUint(buf, dataStart, size.value);
        break;
      case ID.CODEC_ID:
        if (entry) entry.codecId = readAscii(buf, dataStart, size.value);
        break;
      case ID.CODEC_PRIVATE:
        if (entry) entry.codecPrivate = buf.subarray(dataStart, dataEnd);
        break;
      case ID.SAMPLING_FREQUENCY:
        if (entry) entry.sampleRate = readFloat(buf, dataStart, size.value);
        break;
      case ID.CHANNELS:
        if (entry) entry.channels = readUint(buf, dataStart, size.value);
        break;
      case ID.CLUSTER_TIMESTAMP:
        clusterTs = readUint(buf, dataStart, size.value);
        break;
      case ID.SIMPLE_BLOCK:
      case ID.BLOCK: {
        const pkt = parseBlock(buf, dataStart, dataEnd, clusterTs, scaleMs, out.track.number);
        if (pkt && pkt.data.length) {
          out.packets.push(pkt);
          if (pkt.tsMs > out.durationMs) out.durationMs = pkt.tsMs;
        }
        break;
      }
    }

    // Chốt track Opus ngay khi đủ thông tin (TrackNumber + CodecID có thể tới theo thứ tự bất kỳ)
    if (entry && entry.codecId === 'A_OPUS' && entry.number != null) {
      out.track = {
        number: entry.number,
        codecId: entry.codecId,
        sampleRate: entry.sampleRate || 48000,
        channels: entry.channels || 2,
        codecPrivate: entry.codecPrivate || null,
      };
    }

    pos = dataEnd;
  }

  return out;
}
