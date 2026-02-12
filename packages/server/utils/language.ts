// packages/server/utils/language.ts
// Pure function: detect user language for bilingual response (HE/EN)

const HEBREW_SCRIPT = /[\u0590-\u05FF]/;

/**
 * Detect target language from user text.
 * Uses Hebrew script detection; falls back to DEFAULT_LOCALE env, else 'en'.
 */
export function detectLanguage(text: string): 'he' | 'en' {
   const override = process.env.DEFAULT_LOCALE;
   if (override === 'he' || override === 'en') {
      return override;
   }
   if (typeof text !== 'string' || !text.trim()) {
      return 'en';
   }
   return HEBREW_SCRIPT.test(text) ? 'he' : 'en';
}
