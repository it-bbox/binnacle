/**
 * The dashboard's languages, as dictionaries of our own (ADR-0033): no i18n module, and
 * `Intl` for plurals, numbers and relative times in the current language. The page's own text
 * is translated, and the daemon's reasons the page knows by their kind or text; commands, ids,
 * branches, models, repository text and every other message of the daemon stay as they are.
 */
import { en, type Forms } from './en.ts';
import { ru } from './ru.ts';

export type { Dictionary, Forms } from './en.ts';

/** Every dictionary the dashboard has. Adding a language is adding a dictionary here: the Settings page lists it with no further change. */
export const DICTIONARIES = { en, ru };
export type Language = keyof typeof DICTIONARIES;

/** The Settings page's choice: every dictionary, by the name it gives its own language. */
export const LANGUAGES = (Object.keys(DICTIONARIES) as Language[]).map((value) => ({ value, label: DICTIONARIES[value].languageName }));

const isLanguage = (value: string): value is Language => Object.hasOwn(DICTIONARIES, value);

/** The stored choice when it names a dictionary; otherwise the browser's first language when there is a dictionary for it, and English. */
export function startingLanguage(stored: string | null, preferred: readonly string[]): Language {
  if (stored !== null && isLanguage(stored)) return stored;
  const browser = (preferred[0] ?? '').split(/[-_]/)[0]?.toLowerCase() ?? '';
  return isLanguage(browser) ? browser : 'en';
}

/** A number as the language writes it. */
export const formatNumber = (language: Language, value: number): string => new Intl.NumberFormat(language).format(value);

/** Items as one list, "a, b and c", as the language joins them. */
export const formatList = (language: Language, items: string[]): string => new Intl.ListFormat(language).format(items);

/** A number short enough to sit under a bar: 5.3M, 5,3 млн. */
export const compactNumber = (language: Language, value: number): string =>
  new Intl.NumberFormat(language, { notation: 'compact', maximumFractionDigits: 1 }).format(value);

/** A count in the plural form the language takes for it; `#` is the count, formatted in the language. */
export const plural = (language: Language, count: number, forms: Forms): string =>
  (forms[new Intl.PluralRules(language).select(count)] ?? forms.other).replace('#', formatNumber(language, count));

/** How long ago, `seconds` before now, in the language: seconds under a minute, then minutes, hours, and days. */
export function secondsAgo(language: Language, seconds: number): string {
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto', style: 'short' });
  if (seconds < 60) return format.format(-Math.max(0, Math.floor(seconds)), 'second');
  if (seconds < 3600) return format.format(-Math.floor(seconds / 60), 'minute');
  if (seconds < 86_400) return format.format(-Math.floor(seconds / 3600), 'hour');
  return format.format(-Math.floor(seconds / 86_400), 'day');
}

type ReasonKey = keyof typeof en.daemonReasons;

/** A reason the daemon wrote, in the language when the page knows it, and as the daemon wrote it otherwise. */
export function daemonReason(language: Language, reason: string): string {
  const key = (Object.keys(en.daemonReasons) as ReasonKey[]).find((name) => en.daemonReasons[name] === reason);
  return key === undefined ? reason : DICTIONARIES[language].daemonReasons[key];
}

type Touch = { id: string; modules: string[]; from: 'branch' | 'ticket' };
type Pair = { tasks: [string, string]; risk: 'high' | 'medium' | 'low' | 'unknown'; modules: string[]; reason: string };

/**
 * A pair's conflict risk reason in the language, written from its risk and modules and from its
 * Tasks' modules (`impact.tasks`), the names as they are; the daemon's own when a Task of the pair is not in `tasks`.
 */
export function pairReason(language: Language, pair: Pair, tasks: Touch[]): string {
  const said = DICTIONARIES[language].pairReasons;
  const a = tasks.find((task) => task.id === pair.tasks[0]);
  const b = tasks.find((task) => task.id === pair.tasks[1]);
  if (a === undefined || b === undefined) return pair.reason;
  if (pair.risk === 'high') return said.high(pair.modules.join(', '));
  if (pair.risk === 'low') return said.low;
  if (pair.risk === 'medium') {
    const of = (task: Touch): string => said.modulesOf(task.modules.filter((module) => pair.modules.includes(module)).join(', '), task.id);
    return said.medium(of(a), of(b));
  }
  const none = [a, b].filter((task) => task.modules.length === 0).map((task) => (task.from === 'branch' ? said.noModuleFromBranch : said.noModuleFromTicket)(task.id));
  const text = `${none.join('; ')}.`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
