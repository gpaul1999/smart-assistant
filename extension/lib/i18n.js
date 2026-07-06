// Helper i18n cho trang HTML của extension (FR-025). Env-agnostic: nhận hàm getMessage
// qua tham số (Chrome truyền chrome.i18n.getMessage; Node test truyền dict lookup).

/**
 * Dịch mọi phần tử có [data-i18n] (textContent) và [data-i18n-<attr>] (attribute).
 * @param {ParentNode} root
 * @param {(key: string) => string} getMessage
 */
export function localize(root, getMessage) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    const msg = getMessage(el.getAttribute('data-i18n'));
    if (msg) el.textContent = msg;
  }
  for (const el of root.querySelectorAll('*')) {
    for (const attr of el.getAttributeNames?.() || []) {
      if (!attr.startsWith('data-i18n-')) continue;
      const target = attr.slice('data-i18n-'.length);
      const msg = getMessage(el.getAttribute(attr));
      if (msg) el.setAttribute(target, msg);
    }
  }
}

/** getMessage từ dict tĩnh (dùng cho test / preview không có chrome.i18n). */
export function dictGetter(dict) {
  return (key) => dict[key]?.message || '';
}
