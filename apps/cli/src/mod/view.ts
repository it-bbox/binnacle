import { wordMessage, type Coded, type Language } from '@binnacle/core';
import type { Snapshot } from '@binnacle/daemon';

/**
 * What `binnacle-mod` shows (ADR-0047), decided in one pure function the hooks call: they only fetch, call it and
 * draw. Bundled into the mod, so it imports no value from a module that does I/O.
 */

/** Claude Code's figures for the session, as `$.session.usage()` and `session.measure` give them. */
type Usage = { context: { window: number; tokens?: number; percent?: number }; rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[] };

export type ViewInput = Usage & {
  /** The Product Snapshot asked with this session's id; null when it could not be read, which silences the mod. */
  snapshot: Pick<Snapshot, 'activity' | 'checkout' | 'roadmap' | 'next' | 'pendingDecisions' | 'attention'> | null;
  language: Language;
};

/**
 * `status`: the status line's text, undefined to clear it. `band`: the *Waiting for you* band's title and items, undefined
 * when nothing waits. `startLines`: at most three lines for the context of a session whose branch maps to no Task,
 * undefined on a Task's branch or without a snapshot.
 */
export type View = { status: string | undefined; band: { title: string; items: string[] } | undefined; startLines: string[] | undefined };

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
    band: 'Waiting for you',
    questions: 'Unanswered questions',
    approvals: 'Waiting for an approval',
    owner: 'Yours to start',
    /** A count with the first Task's id. */
    first: (count: number, id: string) => (count === 1 ? `${count} (${id})` : `${count} (${id} first)`),
    english: '',
  },
  ru: {
    role: { product: 'продуктовая сессия', implementation: 'реализация', review: 'ревью', rework: 'доработка' },
    output: (count: number) => (count >= 1000 ? undefined : RUSSIAN_OUTPUT[RUSSIAN_PLURAL.select(count)]) ?? 'выходных токенов',
    marks: (partial: boolean) => `(по активности${partial ? ', частично' : ''})`,
    context: 'контекст',
    window: { five_hour: '5 ч', seven_day: '7 дн' } as Record<string, string>,
    band: 'Ждёт вас',
    questions: 'Вопросы без ответа',
    approvals: 'Ждут одобрения',
    owner: 'Начать вам',
    first: (count: number, id: string) => (count === 1 ? `${count} (${id})` : `${count} (сначала ${id})`),
    english: ' (англ.)',
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

/** A daemon's message in the language, worded from its code as `binn` words it, the English marked where core has no wording. */
function say(item: Coded, language: Language): string {
  const { text, english } = wordMessage(language, item);
  return english ? `${text}${WORDS[language].english}` : text;
}

type Listed = { items: { id: string }[]; remainder: number };
const count = (section: Listed): number => section.items.length + section.remainder;

/**
 * The band: the unanswered questions, the approvals and the owner's `ready-for-human` Tasks, each counted with the first
 * one's Task id; `main`'s CI failing and a stale Next action, worded by their codes. A section marked unavailable is
 * left out, and with nothing waiting there is no band.
 */
function band(snapshot: NonNullable<ViewInput['snapshot']>, language: Language): View['band'] {
  const words = WORDS[language];
  const items: string[] = [];
  const pending = snapshot.pendingDecisions;
  if (!('available' in pending)) {
    const sections: [string, Listed | { available: false }][] = [
      [words.questions, pending.questions],
      [words.approvals, pending.approvals],
      [words.owner, pending.owner],
    ];
    for (const [label, section] of sections) {
      if ('available' in section || section.items.length === 0) continue;
      items.push(`${label}: ${words.first(count(section), section.items[0]!.id)}`);
    }
  }
  for (const item of snapshot.attention) if (item.code === 'ci.failing' || item.code === 'next_action.stale') items.push(say(item, language));
  return items.length > 0 ? { title: words.band, items } : undefined;
}

/**
 * The session-start lines, for a session whose branch maps to no Task: the current epic with its status and progress,
 * what waits for the owner as counts, and the Next action with its command; a line with no data is left out. In English
 * whatever the person's language: the agent reads them, and text for an agent stays English (ADR-0045).
 */
function startLines(snapshot: NonNullable<ViewInput['snapshot']>): View['startLines'] {
  if (snapshot.checkout.taskId !== null) return undefined;
  const epic = snapshot.roadmap?.current ?? null;
  const pending = snapshot.pendingDecisions;
  const action = snapshot.next.action;
  const lines = [
    epic && `Current epic: ${epic.number}, ${epic.title} (${epic.status}${epic.progress ? `, ${epic.progress.done} of ${epic.progress.all} Tasks done` : ''})`,
    'available' in pending
      ? null
      : `Waiting for the owner: ${'available' in pending.questions ? '' : `unanswered questions ${count(pending.questions)}, `}waiting for an approval ${count(pending.approvals)}, yours to start ${count(pending.owner)}`,
    action && `Next action: ${action.description} \`${action.command}\``,
  ].filter((line): line is string => Boolean(line));
  return lines.length > 0 ? lines : undefined;
}

/**
 * The status line: the session's Task id and role, or its role alone; its output tokens as Binnacle counts them; its
 * context percentage; and each rate-limit window's use. A part with no data is left out, and no snapshot leaves no line.
 */
export function view({ snapshot, context, rateLimits, language }: ViewInput): View {
  if (snapshot === null) return { status: undefined, band: undefined, startLines: undefined };
  const words = WORDS[language];
  const own = 'own' in snapshot.activity ? snapshot.activity.own : null;
  const role = own && own.role !== 'unknown' ? words.role[own.role] : null;
  const parts = [
    [own?.taskId, role].filter(Boolean).join(' '),
    own ? outputTokens(own.totals, language) : null,
    context.percent !== undefined ? `${words.context} ${percent(context.percent, language)}` : null,
    ...rateLimits.map((limit) => `${words.window[limit.kind] ?? limit.kind} ${percent(limit.percentUsed, language)}`),
  ].filter(Boolean);
  return { status: parts.length > 0 ? parts.join(' · ') : undefined, band: band(snapshot, language), startLines: startLines(snapshot) };
}
