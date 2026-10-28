import type { Language } from '@binnacle/core';
import type { Snapshot } from '@binnacle/daemon';

/**
 * What `binnacle-mod` shows (ADR-0047), decided in one pure function the hooks call: they only fetch, call it and
 * draw. Bundled into the mod, so it imports no value from a module that does I/O.
 */

/** Claude Code's figures for the session, as `$.session.usage()` and `session.measure` give them. */
type Usage = { context: { window: number; tokens?: number; percent?: number }; rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[] };

export type ViewInput = Usage & {
  /** The Product Snapshot asked with this session's id; null when it could not be read, which silences the mod. */
  snapshot: Pick<Snapshot, 'activity'> | null;
  language: Language;
};

/** `status`: the status line's text, undefined to clear it. */
export type View = { status: string | undefined };

type Own = NonNullable<Extract<Snapshot['activity'], { running: unknown }>['own']>;

/** The mod's own labels; a run's role in the dashboard's words, an unknown role being no data. */
const WORDS = {
  en: {
    role: { product: 'product session', implementation: 'implementation', review: 'review', rework: 'rework' },
    tokens: (count: number, text: string) => `${text} token${count === 1 ? '' : 's'} (from activity)`,
    context: 'context',
    window: { five_hour: '5h', seven_day: '7d' },
    decimal: '.',
    thousands: 'k',
    millions: 'M',
  },
  ru: {
    role: { product: 'продуктовая сессия', implementation: 'реализация', review: 'ревью', rework: 'доработка' },
    tokens: (count: number, text: string) => `${text} ${russianTokens(count)} (по активности)`,
    context: 'контекст',
    window: { five_hour: '5 ч', seven_day: '7 дн' },
    decimal: ',',
    thousands: ' тыс.',
    millions: ' млн',
  },
} satisfies Record<Language, unknown>;

/** «токен» agreeing with a whole count; a compact one («1,2 млн») takes the genitive plural. */
function russianTokens(count: number): string {
  const [ten, hundred] = [count % 10, count % 100];
  if (!Number.isInteger(count) || count >= 1000) return 'токенов';
  if (ten === 1 && hundred !== 11) return 'токен';
  return ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14) ? 'токена' : 'токенов';
}

/** A number with at most one decimal, in the language's notation. */
const decimal = (value: number, language: Language): string => String(Math.round(value * 10) / 10).replace('.', WORDS[language].decimal);

/** A count in short form: whole under a thousand, then thousands and millions with one decimal. No `Intl`, which the mod's environment need not have. */
function compact(count: number, language: Language): string {
  const words = WORDS[language];
  if (count >= 999_950) return `${decimal(count / 1_000_000, language)}${words.millions}`;
  if (count >= 1000) return `${decimal(count / 1000, language)}${words.thousands}`;
  return String(count);
}

/** Every token the session's runs count once: input, cached input, cache creation and output, reasoning being inside output; null when none reported. */
function sessionTokens(totals: Own['totals']): number | null {
  const fields = [totals.input, totals.cachedInput, totals.cacheCreation, totals.output];
  return fields.every((field) => field.tokens === null) ? null : fields.reduce((sum, field) => sum + (field.tokens ?? 0), 0);
}

/**
 * The status line: the session's Task id and role, or its role alone; its tokens as Binnacle counts them; its context
 * percentage; and each rate-limit window's use. A part with no data is left out, and no snapshot leaves no line.
 */
export function view({ snapshot, context, rateLimits, language }: ViewInput): View {
  if (snapshot === null) return { status: undefined };
  const words = WORDS[language];
  const own = 'own' in snapshot.activity ? snapshot.activity.own : null;
  const role = own && own.role !== 'unknown' ? words.role[own.role] : null;
  const tokens = own && sessionTokens(own.totals);
  const parts = [
    [own?.taskId, role].filter(Boolean).join(' '),
    tokens !== null && tokens !== undefined ? words.tokens(tokens, compact(tokens, language)) : '',
    context.percent !== undefined ? `${words.context} ${decimal(context.percent, language)}%` : '',
    ...rateLimits.map((limit) => `${(words.window as Record<string, string>)[limit.kind] ?? limit.kind} ${decimal(limit.percentUsed, language)}%`),
  ].filter(Boolean);
  return { status: parts.length > 0 ? parts.join(' · ') : undefined };
}
