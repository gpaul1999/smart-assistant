import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assess, fmtBytes, BYTES_PER_HOUR } from '../../extension/lib/storage-policy.js';

const GB = 1024 ** 3;

test('assess: các ngưỡng ok / warn (70%) / critical (90%)', () => {
  assert.equal(assess({ usage: 1 * GB, quota: 10 * GB }).level, 'ok');
  assert.equal(assess({ usage: 6.9 * GB, quota: 10 * GB }).level, 'ok');
  assert.equal(assess({ usage: 7 * GB, quota: 10 * GB }).level, 'warn');
  assert.equal(assess({ usage: 8.9 * GB, quota: 10 * GB }).level, 'warn');
  assert.equal(assess({ usage: 9 * GB, quota: 10 * GB }).level, 'critical');
  assert.equal(assess({ usage: 10 * GB, quota: 10 * GB }).level, 'critical');
});

test('assess: remainingHours theo 30MB/giờ', () => {
  const { remainingHours } = assess({ usage: 0, quota: BYTES_PER_HOUR * 5 });
  assert.equal(remainingHours, 5);
});

test('assess: thiếu API / quota 0 → unknown, không chia cho 0', () => {
  assert.equal(assess({}).level, 'unknown');
  assert.equal(assess({ usage: 1, quota: 0 }).level, 'unknown');
  assert.equal(assess().level, 'unknown');
});

test('fmtBytes', () => {
  assert.equal(fmtBytes(512), '512 B');
  assert.equal(fmtBytes(30 * 1024 ** 2), '30.0 MB');
  assert.equal(fmtBytes(2.5 * GB), '2.5 GB');
  assert.equal(fmtBytes(undefined), '—');
});
