// Công cụ dev: sinh cặp key Ed25519 và ký license key thử.
//   node scripts/make-license.mjs --keygen            → in public/private key (b64url)
//   PRIV=<b64url> node scripts/make-license.mjs user@x [expDays]  → in license key
import { webcrypto as crypto } from 'node:crypto';

const b64url = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

if (process.argv.includes('--keygen')) {
  const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey));
  const priv = new Uint8Array(await crypto.subtle.exportKey('pkcs8', privateKey));
  console.log('PUBLIC (raw b64url): ', b64url(pub));
  console.log('PRIVATE (pkcs8 b64url):', b64url(priv));
  process.exit(0);
}

const sub = process.argv[2];
if (!sub || !process.env.PRIV) {
  console.error('Usage: PRIV=<pkcs8-b64url> node scripts/make-license.mjs <sub> [expDays]');
  process.exit(1);
}
const expDays = Number(process.argv[3] || 0);
const payload = { plan: 'pro', sub, iat: Math.floor(Date.now() / 1000) };
if (expDays > 0) payload.exp = payload.iat + expDays * 86400;

const priv = await crypto.subtle.importKey('pkcs8', fromB64url(process.env.PRIV), { name: 'Ed25519' }, false, ['sign']);
const payloadB64 = b64url(Buffer.from(JSON.stringify(payload)));
const sig = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, priv, Buffer.from(payloadB64)));
console.log(`SMA1.${payloadB64}.${b64url(sig)}`);
