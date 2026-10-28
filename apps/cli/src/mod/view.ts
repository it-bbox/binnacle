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

/** «выходной токен» agreeing with a whole count; a short one («1,2 млн») takes the genitive plural. */
const RUSSIAN_PLURAL = new Intl.PluralRules('ru');
const RUSSIAN_OUTPUT: Partial<Record<Intl.LDMLPluralRule, string>> = { one: 'выходной токен', few: 'выходных токена', many: 'выходных токенов' };

/** The mod's own labels; a run's role in the dashboard's words, an unknown role being no data. */
const WORDS = {
  en: {
    role: { product: 'product session', implementation: 'implementation', review: 'review', rework: 'rework' },
    output: (count: number) => `output token${count === 1 ? '' : 's'}`,
    marks: (partial: boolean) => `(from activity${partial ? ', partial' : ''})`,
    context: 'context',
    window: { five_hour: '5h', seven_day: '7d' } as Record<string, string>,
  },
  ru: {
    role: { product: 'продуктовая сессия', implementation: 'реализация', review: 'ревью', rework: 'доработка' },
    output: (count: number) => (count >= 1000 ? undefined : RUSSIAN_OUTPUT[RUSSIAN_PLURAL.select(count)]) ?? 'выходных токенов',
    marks: (partial: boolean) => `(по активности${partial ? ', частично' : ''})`,
    context: 'контекст',
    window: { five_hour: '5 ч', seven_day: '7 дн' } as Record<string, string>,
  },
} satisfies Record<Language, unknown>;

/** A count in short form, `1.2M` or `1,2 млн`, and a percentage with at most one decimal, in the language's notation. */
const short = (count: number, language: Language): string => new Intl.NumberFormat(language, { notation: 'compact', maximumFractionDigits: 1 }).format(count);
const percent = (value: number, language: Language): string => `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value)}%`;

/**
 * The session's output tokens, the one kind the dashboard shows by default: kinds are never added together
 * (`docs/04-telemetry-dashboard.md`, *Usage*). Null when no record reported it, marked partial when only some did.
 */
function outputTokens({ output }: Own['totals'], language: Language): string | null {
  if (output.tokens === null) return null;
  const words = WORDS[language];
  return `${short(output.tokens, language)} ${words.output(output.tokens)} ${words.marks(output.partial)}`;
}

/**
 * The status line: the session's Task id and role, or its role alone; its output tokens as Binnacle counts them; its
 * context percentage; and each rate-limit window's use. A part with no data is left out, and no snapshot leaves no line.
 */
export function view({ snapshot, context, rateLimits, language }: ViewInput): View {
  if (snapshot === null) return { status: undefined };
  const words = WORDS[language];
  const own = 'own' in snapshot.activity ? snapshot.activity.own : null;
  const role = own && own.role !== 'unknown' ? words.role[own.role] : null;
  const parts = [
    [own?.taskId, role].filter(Boolean).join(' '),
    own ? outputTokens(own.totals, language) : null,
    context.percent !== undefined ? `${words.context} ${percent(context.percent, language)}` : null,
    ...rateLimits.map((limit) => `${words.window[limit.kind] ?? limit.kind} ${percent(limit.percentUsed, language)}`),
  ].filter(Boolean);
  return { status: parts.length > 0 ? parts.join(' · ') : undefined };
}
