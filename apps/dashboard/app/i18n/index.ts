/**
 * The dashboard's two languages, as a dictionary of our own (ADR-0033): no i18n module, and
 * `Intl` for plurals, numbers and relative times in the current language. Only the page's own
 * text is translated; commands, ids, branches, models, repository text and the daemon's
 * messages stay as they are.
 */
import { en, type Forms } from './en.ts';
import { ru } from './ru.ts';

export type Language = 'en' | 'ru';
export type { Dictionary, Forms } from './en.ts';

export const DICTIONARIES = { en, ru };

/** The stored choice when it names a language; otherwise Russian when the browser prefers it, and English. */
export function startingLanguage(stored: string | null, preferred: readonly string[]): Language {
  if (stored === 'en' || stored === 'ru') return stored;
  return /^ru\b/i.test(preferred[0] ?? '') ? 'ru' : 'en';
}

/** A count in the plural form the language takes for it; `#` is the count, formatted in the language. */
export const plural = (language: Language, count: number, forms: Forms): string =>
  (forms[new Intl.PluralRules(language).select(count)] ?? forms.other).replace('#', new Intl.NumberFormat(language).format(count));

/** How long ago, `seconds` before now, in the language: seconds under a minute, then minutes, then hours. */
export function ago(language: Language, seconds: number): string {
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto', style: 'short' });
  if (seconds < 60) return format.format(-Math.max(0, Math.floor(seconds)), 'second');
  if (seconds < 3600) return format.format(-Math.floor(seconds / 60), 'minute');
  return format.format(-Math.floor(seconds / 3600), 'hour');
}
