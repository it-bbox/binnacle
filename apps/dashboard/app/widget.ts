/**
 * A widget's level (`docs/specs/dashboard-redesign/spec.md`, *A widget with two levels*): *Brief*
 * shows its essentials, *Full* everything it has. Kept in the browser per page and widget, and
 * *Brief* when nothing is stored or the storage refuses. Free of Nuxt, for the tests.
 */
export const LEVELS = ['brief', 'full'] as const;
export type Level = (typeof LEVELS)[number];

/** A list folds after this many rows (a text after six lines, `FoldedText.vue`), and unfolds in place. */
export const LIST_FOLD = 6;
/** The rows a widget's *Brief* gives a list it only previews, such as the first attention items. */
export const BRIEF_ROWS = 3;

const key = (page: string, widget: string): string => `binnacle.widget.${page}.${widget}`;

export function readLevel(page: string, widget: string, storage: () => Storage = () => localStorage): Level {
  try {
    return storage().getItem(key(page, widget)) === 'full' ? 'full' : 'brief';
  } catch {
    return 'brief';
  }
}

export function storeLevel(page: string, widget: string, level: Level, storage: () => Storage = () => localStorage): void {
  try {
    storage().setItem(key(page, widget), level);
  } catch {
    // Storage refused: the choice holds until the page is reloaded.
  }
}

/** Whether a widget that folds to a strip, such as the Project page's epics, is folded: kept as its level is, unfolded by default. */
export function readFolded(page: string, widget: string, storage: () => Storage = () => localStorage): boolean {
  try {
    return storage().getItem(`${key(page, widget)}.folded`) === 'true';
  } catch {
    return false;
  }
}

export function storeFolded(page: string, widget: string, folded: boolean, storage: () => Storage = () => localStorage): void {
  try {
    storage().setItem(`${key(page, widget)}.folded`, String(folded));
  } catch {
    // Storage refused: the choice holds until the page is reloaded.
  }
}
