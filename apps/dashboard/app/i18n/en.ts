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

  unknownProject: 'No registered project is at this address.',
  whatsNext: "What's next",
  fromRoadmap: 'From the roadmap',
  noNextAction: 'The roadmap gives no Next action. Attention says why.',
  calculation: "Binnacle's calculation",
  noSuggestion: 'Binnacle has no suggestion.',
  trackerUnreadable: 'The tracker cannot be read',
  epicProgress: 'Epic progress',
  openBoard: 'Open the board',
  tasksDone: (done: string, all: string) => `${done} of ${all} Tasks done`,
  noTasks: 'No Tasks yet',
  noTasksBody: 'Tasks appear here once the Epic is sliced into tickets.',
  readyToStart: 'Ready to start, in any order',
  inParallel: (free: string) => `up to ${free} can run in parallel`,
  waitsOn: (ids: string) => `waits on ${ids}`,
  runningNow: 'Running now',
  runningNote: '“Running” is Binnacle’s reading of recent activity.',
  noTask: 'no Task',
  nothing: 'Nothing',
  more: (count: string) => `and ${count} more`,
  allProjects: 'All projects',
  outputTokens: 'Output tokens',
  today: 'today',
  last7Days: 'last 7 days',
  noRecords: 'no records',
  notReported: 'not reported',
  partial: 'partial',

  copy: 'Copy',
  copied: 'Copied',
  copyFailed: 'Copy failed: select the command and copy it by hand.',
};

export type Dictionary = typeof en;
