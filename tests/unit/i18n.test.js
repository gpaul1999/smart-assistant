import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localize, dictGetter } from '../../extension/lib/i18n.js';
import { readFileSync } from 'node:fs';

// DOM giả tối thiểu cho localize (env-agnostic — không cần jsdom)
function fakeEl(attrs = {}) {
  return {
    attrs: { ...attrs },
    textContent: '',
    getAttribute(n) { return this.attrs[n] ?? null; },
    setAttribute(n, v) { this.attrs[n] = v; },
    getAttributeNames() { return Object.keys(this.attrs); },
  };
}

test('localize điền textContent và attribute', () => {
  const a = fakeEl({ 'data-i18n': 'onbTitle' });
  const b = fakeEl({ 'data-i18n-placeholder': 'popLicensePlaceholder' });
  const root = {
    querySelectorAll(sel) { return sel === '[data-i18n]' ? [a] : [a, b]; },
  };
  const dict = {
    onbTitle: { message: 'Xin chào' },
    popLicensePlaceholder: { message: 'Dán key' },
  };
  localize(root, dictGetter(dict));
  assert.equal(a.textContent, 'Xin chào');
  assert.equal(b.attrs.placeholder, 'Dán key');
});

test('hai file locale vi/en có cùng bộ key', () => {
  const vi = JSON.parse(readFileSync('extension/_locales/vi/messages.json', 'utf8'));
  const en = JSON.parse(readFileSync('extension/_locales/en/messages.json', 'utf8'));
  assert.deepEqual(Object.keys(vi).sort(), Object.keys(en).sort());
});
