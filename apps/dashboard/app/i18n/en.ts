/**
 * The English dictionary, which the Russian one is typed against: a key missing there fails
 * the typecheck. The domain terms stay English in both: Task, Epic, Next action, Suggested
 * step, Backlog, Ready, In progress, Done, Review, Unmet dependency.
 */

/** A count's forms by `Intl.PluralRules` category; `other` is the fallback, `#` the count. */
export type Forms = { other: string } & Partial<Record<Intl.LDMLPluralRule, string>>;

export const en = {
  overview: 'Overview',
  project: 'Project',
  usage: 'Usage',
  attention: 'Attention',
  projects: 'Projects',
  menu: 'Pages',
  projectRail: 'Registered projects',
  language: 'Language',

  currentEpic: 'Current Epic',
  everyEpicDone: 'Every Epic is done',
  noEpics: 'The roadmap lists no Epic',
  notAvailable: 'Not available',
  noRoadmap: 'The roadmap cannot be read',
  noProject: 'No project is registered.',

  runsRunning: { one: '# run running', other: '# runs running' } as Forms,
  attentionItems: { one: '# item needs attention', other: '# items need attention' } as Forms,

  updated: (ago: string) => `updated ${ago}`,
  lastReply: (ago: string) => `last reply ${ago}`,
  connecting: 'connecting…',

  addProject: 'Add a project',
  addBody: "In the project's folder, run:",
  addNote: 'Binnacle shows the project on its next refresh. Nothing is registered from this page.',

  signin: 'To open the dashboard, run:',
  loading: 'Connecting to the daemon…',
  daemonTitle: "Binnacle's daemon is not reachable",
  daemonBody: 'The dashboard reads everything from the local daemon. Start it, and this page reconnects by itself.',
  retrying: { one: 'Asking again every # second.', other: 'Asking again every # seconds.' } as Forms,
  failed: 'The daemon answered with an error:',

  copy: 'Copy',
  copied: 'Copied',
  copyFailed: 'Copy failed: select the command and copy it by hand.',
};

export type Dictionary = typeof en;
