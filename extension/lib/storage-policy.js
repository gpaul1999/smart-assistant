// Chính sách dung lượng lưu trữ (spec 001 FR-019, research R4).
// Thuần JS — UI truyền {usage, quota} từ navigator.storage.estimate() vào.

/** Opus 64kbps ≈ 8KB/s → ~28MB/giờ; làm tròn 30MB cho an toàn. */
export const BYTES_PER_HOUR = 30 * 1024 * 1024;

export const WARN_RATIO = 0.7;
export const CRITICAL_RATIO = 0.9;

/**
 * @param {{usage?: number, quota?: number}} estimate
 * @returns {{level: 'ok'|'warn'|'critical'|'unknown', ratio: number, remainingHours: number|null}}
 */
export function assess({ usage, quota } = {}) {
  if (!Number.isFinite(quota) || quota <= 0 || !Number.isFinite(usage) || usage < 0) {
    return { level: 'unknown', ratio: 0, remainingHours: null };
  }
  const ratio = Math.min(usage / quota, 1);
  const level = ratio >= CRITICAL_RATIO ? 'critical' : ratio >= WARN_RATIO ? 'warn' : 'ok';
  const remainingHours = Math.max(quota - usage, 0) / BYTES_PER_HOUR;
  return { level, ratio, remainingHours };
}

export function fmtBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}
