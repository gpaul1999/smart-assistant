import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyLicense,
  parseLicenseKey,
  bytesToB64url,
} from '../../extension/lib/license.js';

const subtle = globalThis.crypto.subtle;
let pubB64, key, expiredKey;

async function sign(payload, privateKey) {
  const payloadB64 = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = new Uint8Array(
    await subtle.sign({ name: 'Ed25519' }, privateKey, new TextEncoder().encode(payloadB64))
  );
  return `SMA1.${payloadB64}.${bytesToB64url(sig)}`;
}

before(async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  pubB64 = bytesToB64url(new Uint8Array(await subtle.exportKey('raw', kp.publicKey)));
  const iat = Math.floor(Date.now() / 1000);
  key = await sign({ plan: 'pro', sub: 'test@x', iat }, kp.privateKey);
  expiredKey = await sign({ plan: 'pro', sub: 'test@x', iat, exp: iat - 100 }, kp.privateKey);
});

test('key hợp lệ → valid + payload', async () => {
  const out = await verifyLicense(key, pubB64);
  assert.equal(out.valid, true);
  assert.equal(out.payload.plan, 'pro');
  assert.equal(out.payload.sub, 'test@x');
});

test('key bị sửa 1 ký tự → bad-signature', async () => {
  const tampered = key.slice(0, -2) + (key.endsWith('A') ? 'B' : 'A') + key.slice(-1);
  const out = await verifyLicense(tampered, pubB64);
  assert.equal(out.valid, false);
});

test('payload bị sửa (đổi sub) nhưng giữ sig → bad-signature', async () => {
  const parsed = parseLicenseKey(key);
  const fakePayload = bytesToB64url(
    new TextEncoder().encode(JSON.stringify({ ...parsed.payload, sub: 'hacker' }))
  );
  const out = await verifyLicense(`SMA1.${fakePayload}.${parsed.sigB64}`, pubB64);
  assert.equal(out.valid, false);
  assert.equal(out.reason, 'bad-signature');
});

test('key hết hạn → expired', async () => {
  const out = await verifyLicense(expiredKey, pubB64);
  assert.equal(out.valid, false);
  assert.equal(out.reason, 'expired');
});

test('format rác → bad-format', async () => {
  assert.equal((await verifyLicense('not-a-key', pubB64)).reason, 'bad-format');
  assert.equal((await verifyLicense('', pubB64)).reason, 'bad-format');
  assert.equal(parseLicenseKey('SMA1.@@.__'), null);
});

test('public key sai → không valid', async () => {
  const out = await verifyLicense(key, bytesToB64url(new Uint8Array(32)));
  assert.equal(out.valid, false);
});
