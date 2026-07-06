// License Pro — verify OFFLINE bằng chữ ký Ed25519 (spec 002 FR-029, research R8).
// Key format: SMA1.<base64url(payload JSON)>.<base64url(signature)>
// payload: { plan: 'pro', sub: string, iat: number, exp?: number (epoch giây) }
// WebCrypto Ed25519 có ở Chrome hiện đại và Node ≥20 → unit test được.
// KHÔNG có network: public key nhúng, không gửi key đi đâu (Constitution I).

// Public key production (raw Ed25519, base64url) — thay bằng key thật trước khi phát hành.
// Sinh cặp key: node scripts/make-license.mjs --keygen
export const PROD_PUBLIC_KEY = 'REPLACE_WITH_PROD_PUBLIC_KEY_B64URL';

const subtle = globalThis.crypto?.subtle;

export function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Parse không verify — tách phần payload/sig. Trả null nếu sai format. */
export function parseLicenseKey(key) {
  const m = /^SMA1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec((key || '').trim());
  if (!m) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(m[1])));
    return { payloadB64: m[1], sigB64: m[2], payload };
  } catch {
    return null;
  }
}

/**
 * Verify key với public key (base64url raw Ed25519).
 * @returns {Promise<{valid: boolean, reason?: string, payload?: object}>}
 */
export async function verifyLicense(key, publicKeyB64url, { now = Date.now() } = {}) {
  if (!subtle) return { valid: false, reason: 'no-webcrypto' };
  const parsed = parseLicenseKey(key);
  if (!parsed) return { valid: false, reason: 'bad-format' };

  let pubKey;
  try {
    pubKey = await subtle.importKey('raw', b64urlToBytes(publicKeyB64url), { name: 'Ed25519' }, false, ['verify']);
  } catch {
    return { valid: false, reason: 'bad-public-key' };
  }

  const data = new TextEncoder().encode(parsed.payloadB64);
  const ok = await subtle.verify({ name: 'Ed25519' }, pubKey, b64urlToBytes(parsed.sigB64), data);
  if (!ok) return { valid: false, reason: 'bad-signature' };

  const p = parsed.payload;
  if (p.plan !== 'pro') return { valid: false, reason: 'bad-plan' };
  if (p.exp && p.exp * 1000 < now) return { valid: false, reason: 'expired' };
  return { valid: true, payload: p };
}
