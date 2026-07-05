// Dịch on-device qua Chrome Translator API + Language Detector API (Chrome 138+).
// Không có API (Chrome cũ / thiếu model) → trả null, UI hiển thị nguyên bản.

const translators = new Map();
let detectorPromise = null;

export function translationAvailable() {
  return typeof globalThis.Translator !== 'undefined';
}

async function getDetector() {
  if (typeof globalThis.LanguageDetector === 'undefined') return null;
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const a = await globalThis.LanguageDetector.availability();
      if (a === 'unavailable') return null;
      return globalThis.LanguageDetector.create();
    })().catch(() => null);
  }
  return detectorPromise;
}

export async function detectLang(text) {
  const detector = await getDetector();
  if (!detector) return null;
  try {
    const [best] = await detector.detect(text);
    return best && best.confidence > 0.4 ? best.detectedLanguage : null;
  } catch {
    return null;
  }
}

async function getTranslator(sourceLang, targetLang) {
  const key = `${sourceLang}>${targetLang}`;
  if (!translators.has(key)) {
    translators.set(
      key,
      (async () => {
        const a = await globalThis.Translator.availability({
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
        });
        if (a === 'unavailable') return null;
        return globalThis.Translator.create({
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
        });
      })().catch(() => null)
    );
  }
  return translators.get(key);
}

/**
 * Dịch text sang targetLang. sourceLang='auto' → tự phát hiện.
 * Trả về string đã dịch, hoặc null nếu không dịch được / không cần dịch.
 */
export async function translateText(text, { sourceLang = 'auto', targetLang }) {
  if (!targetLang || !text?.trim() || !translationAvailable()) return null;
  let src = sourceLang;
  if (!src || src === 'auto') src = await detectLang(text);
  if (!src || src === targetLang) return null;
  const tr = await getTranslator(src, targetLang);
  if (!tr) return null;
  try {
    return await tr.translate(text);
  } catch {
    return null;
  }
}
