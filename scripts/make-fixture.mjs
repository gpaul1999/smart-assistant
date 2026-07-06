// Sinh tests/fixtures/sample.webm bằng CHÍNH MediaRecorder của Chromium (oscillator ~4s,
// timeslice 500ms) — đúng cấu trúc WebM mà extension ghi ra, làm ground truth cho
// lib/webm-opus.js. Chạy một lần: node scripts/make-fixture.mjs
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'tests/fixtures/sample.webm');

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();

const b64 = await page.evaluate(async () => {
  const ctx = new AudioContext();
  await ctx.resume();
  const osc = ctx.createOscillator();
  osc.frequency.value = 440;
  const dest = ctx.createMediaStreamDestination();
  osc.connect(dest);
  osc.start();

  const rec = new MediaRecorder(dest.stream, {
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 64000,
  });
  const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  rec.start(500);
  await new Promise((r) => setTimeout(r, 4000));
  await new Promise((r) => {
    rec.onstop = r;
    rec.stop();
  });

  const buf = new Uint8Array(await new Blob(chunks).arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  }
  return btoa(s);
});

await browser.close();
mkdirSync(dirname(outPath), { recursive: true });
const bytes = Buffer.from(b64, 'base64');
writeFileSync(outPath, bytes);
console.log('wrote', outPath, bytes.length, 'bytes');
