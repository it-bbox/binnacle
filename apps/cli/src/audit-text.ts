import { wordMessage, type AuditArea, type Coded, type Finding, type Language } from '@binnacle/core';
import { describeSets } from './layout.ts';

/**
 * `binn audit`'s words (spec `human-output`, *`binn audit`'s findings carry their values*): each finding's reason and
 * recommendation, worded from the values it carries, and the report around them, in English and Russian. `--json` takes
 * the English, exactly as the audit wrote it before it had a Russian; the text takes the person's language. Paths, commands,
 * file names and the names of tools, harnesses and token formats are never translated.
 */

type Wording = { reason: string; recommendation?: string };
const r = (reason: string, recommendation?: string): Wording => (recommendation === undefined ? { reason } : { reason, recommendation });

const PLURAL = new Intl.PluralRules('ru');
/** `count` with its Russian noun in the right form: one, few, many. */
export const counted = (count: number, [one, few, many]: [string, string, string]): string => {
  const form = PLURAL.select(count);
  return `${count} ${form === 'one' ? one : form === 'few' ? few : many}`;
};

/** A daemon's or core's coded message in Russian, its English marked when core has no wording for it. */
const russian = (item: Coded): string => {
  const { text, english } = wordMessage('ru', item);
  return english ? `${text} (англ.)` : text;
};

type Use = 'installed' | 'optional' | 'unused';
type LsFiles = 'documents' | 'containers' | 'files';
/** A `.dockerignore` that keeps something out of no build context: missing (null), or not excluding the names listed. */
type IgnoreProblem = { ignore: string; missing: string[] | null };
type Stale = { where: string; reason: string; differ: { skill: string; version: string | null }[]; missing: string[]; version: string | null };

const HISTORY = "If the commit was ever pushed, the value is in Git's history, and rewriting that history is your decision. The audit reads only the tracked files as they are now; gitleaks scans the history.";

const en = {
  'git.repository': ({ branch, empty }: { branch: string | null; empty: boolean }) =>
    r(`A Git repository, on ${branch === null ? 'a detached HEAD' : `branch ${branch}${empty ? ' (no commit yet)' : ''}`}.`),
  'manifest.present': ({ path }: { path: string }) => r(`${path} is present.`),
  'manifest.missing': ({ path }: { path: string }) =>
    r(`${path} is missing, so Binnacle has no declaration of this project.`, 'Run binn init, which shows the file it would create and writes it only after you confirm.'),
  'provider.local': () => r('No remote, so no remote tracker. Local tickets under docs/specs/ are a tracker Binnacle reads.'),
  'provider.unrecognised': ({ remote }: { remote: string }) =>
    r(
      `The remote ${remote} is not recognised as GitHub or GitLab from its URL, so Binnacle would read local tickets under docs/specs/.`,
      'If the remote is a self-hosted GitHub or GitLab, declare it in the tracker section of .binnacle/project.yaml.',
    ),
  'provider.forge': ({ provider, repository, host }: { provider: string; repository: string; host: string }) => r(`The remote names a ${provider} tracker, ${repository} on ${host}.`),
  'token.unusable': ({ failure }: { failure: Coded }) => r(failure.message, 'Fix the token as that message says.'),
  'token.none': ({ variable, host }: { variable: string; host: string }) =>
    r(
      `No tracker token: ${variable} is not set and the credentials file has no entry for ${host}.`,
      'A public repository needs none. For a private one, give Binnacle a read-only token (docs/operations/05-installation-checklist.md, Tracker credentials).',
    ),
  'token.present': () => r('A tracker token is present, in the environment or the credentials file. Its value is not shown.'),
  'token.works': () => r('Whether a token works is known only from the network, which the audit does not use.', 'Run binn init, which reads the tracker once and says whether it was readable.'),
  'worktree.unset': () => r('extensions.worktreeConfig is not set.'),
  'worktree.unreadable': () =>
    r('Git could not read extensions.worktreeConfig or the common Git directory.', 'Run git config --local --bool --get extensions.worktreeconfig in the repository to see why.'),
  'worktree.used': ({ path }: { path: string }) => r(`extensions.worktreeConfig is set, and ${path} uses it.`),
  'worktree.unused': () =>
    r(
      "extensions.worktreeConfig is set, but no config.worktree uses it, in the common Git directory or any worktree's. Git ignores it; Antigravity's Git library refuses the repository, so Antigravity's agent cannot work in it.",
      'Unset it with git config --unset extensions.worktreeconfig; nothing reads it, so nothing else changes.',
    ),

  exists: ({ path }: { path: string }) => r(`${path} exists.`),
  'context.missing': () => r('No CONTEXT.md: the glossary of the domain an agent reads first.', 'Write CONTEXT.md; /grill-with-docs builds it as terms are settled.'),
  'adr.missing': () => r('No docs/adr: no architecture decisions are recorded.', 'Record durable trade-offs as ADRs under docs/adr.'),
  'docs.missing': () => r('No docs: no durable documentation directory.', 'Keep durable knowledge as Markdown under docs/.'),
  'roadmap.unknown': ({ manifest }: { manifest: string }) =>
    r(`${manifest} cannot be read as a manifest, so where its roadmap is, knowledge.docs, is not known.`, `Fix ${manifest}; binn init names its problems.`),
  'roadmap.undeclared': ({ manifest }: { manifest: string }) =>
    r(`${manifest} declares no knowledge.docs, so Binnacle reads no roadmap.`, `Declare knowledge.docs in ${manifest}, the directory whose roadmap.md is the roadmap.`),
  'roadmap.missing': ({ path }: { path: string }) =>
    r(`No roadmap at ${path}, so Binnacle shows no position and no Next action.`, "Run binn init, which proposes a roadmap skeleton in Binnacle's format and writes it only after you confirm."),
  'roadmap.ok': ({ path }: { path: string }) => r(`${path} is in Binnacle's format.`),
  'roadmap.format': ({ path, gaps }: { path: string; gaps: Coded[] }) =>
    r(
      `${path} is not in Binnacle's format. ${gaps.map(({ message }) => message).join(' ')}`,
      `Bring ${path} into the format by hand, keeping its content; binn init never rewrites an existing roadmap.`,
    ),
  'ls-files.failed': ({ what }: { what: LsFiles }) =>
    r(`git ls-files failed, so the tracked ${{ documents: 'documents', containers: 'container files', files: 'files' }[what]} are not known.`, 'Run git ls-files in the repository to see why.'),
  'stranded.none': () => r("No tracked document outside Binnacle's places names a plan, a spec, a decision, notes or a roadmap."),
  'stranded.found': ({ paths }: { paths: string[] }) =>
    r(`Documents outside Binnacle's places, where each belongs is a judgement: ${paths.join(', ')}.`, 'Run /binnacle:roadmap, which proposes a place for each and moves nothing without your yes.'),

  'layout.ok': ({ present, specs }: { present: string[]; specs: number }) => r(`The layout is in place: ${present.join(', ')}, and ${specs} spec${specs === 1 ? '' : 's'} under docs/specs/.`),
  'layout.none': ({ missing }: { missing: string[] }) =>
    r(`No Matt Pocock layout: ${missing.join(', ')} are all missing.`, 'Run binn init, which writes the convention files; /to-spec writes the spec directories.'),
  'layout.partial': ({ present, missing }: { present: string[]; missing: string[] }) =>
    r(
      `The Matt Pocock layout is partial. Present: ${present.join(', ')}. Missing: ${missing.join(', ')}.`,
      'Add only the missing parts: binn init writes the missing convention files, and /to-spec the spec directories.',
    ),
  'header.ok': ({ path }: { path: string }) => r(`${path} has its ticket-header section.`),
  'header.missing': ({ path, file }: { path: string; file: boolean }) =>
    r(
      `${path} has no ticket-header convention${file ? '' : ' (the file is missing)'}, which Binnacle reads a ticket's state and dependencies from (ADR-0024).`,
      `Run binn init, which offers ${file ? 'to add the section' : 'the file with the section'}.`,
    ),

  'scratch.none': () => r('No .scratch directory, so nothing to check.'),
  'scratch.exists': () => r('.scratch exists.'),
  'scratch.ignored': () => r('Git ignores .scratch.'),
  'scratch.unignored': () => r('Git does not ignore .scratch, so its working files can be committed by mistake.', 'Add .scratch/ to .gitignore.'),
  'scratch.clean': () => r('.scratch holds no spec or ticket that is not also under docs/specs/.'),
  'scratch.durable': ({ paths }: { paths: string[] }) =>
    r(
      `.scratch holds what looks like the only copy of a spec or a ticket: ${paths.join(', ')}.`,
      'Move each into Git, a spec under docs/specs/<slug>/ and its tickets under docs/specs/<slug>/issues/, before a worktree removal loses it.',
    ),

  'tool.declared': ({ manifest, title, use }: { manifest: string; title: string; use: Use }) =>
    r(`${manifest} declares that ${title} ${{ installed: 'is installed', optional: 'is optional', unused: 'is not used' }[use]}. The declaration is taken as it stands.`),
  'tool.found': ({ title, where }: { title: string; where: string }) => r(`${title} looks configured: found in ${where}.`),
  'tool.missing': ({ title, looked, user, manifest }: { title: string; looked: string; user: string; manifest: string }) =>
    r(
      `No ${title} configuration found in ${looked} (repository), or ${user} (user scope). It may be configured somewhere else.`,
      `If an agent here should reach ${title}, declare it under capabilities in ${manifest}.`,
    ),
  'skills.stale': ({ where, reason }: Stale) =>
    r(`Binnacle's skills in ${where} are stale: ${reason}. Every harness the skills CLI installed them into runs the old ones.`, "Run binn init, and confirm its plan: it reinstalls Binnacle's skills."),

  'instructions.none': () => r('No AGENTS.md or CLAUDE.md: a first agent starts without instructions.', 'Write AGENTS.md; have CLAUDE.md hold @AGENTS.md if Claude Code needs its own file.'),
  'instructions.one': ({ sets }: { sets: string[][] }) => r(`One instruction set: ${describeSets(sets)}.`),
  'instructions.two': ({ sets }: { sets: string[][] }) =>
    r(
      `Two instruction files that do not import each other: ${describeSets(sets)}. An agent may read two truths.`,
      'Decide which is canonical, and have the other import it (a CLAUDE.md holding @AGENTS.md).',
    ),

  'tests.found': ({ script, files }: { script: boolean; files: string[] }) => r(`A test setup: ${[...(script ? ['a test script in package.json'] : []), ...files].join(', ')}. It was not run.`),
  'tests.none': () => r('No test setup found: no test script, test configuration or test directory.', 'Add tests and a command that runs them, so a change can be checked.'),
  'ci.found': ({ files }: { files: string[] }) => r(`A CI configuration: ${files.join(', ')}. It was not run.`),
  'ci.none': () => r('No CI configuration found.', 'Add a CI pipeline that runs the tests on every push.'),
  'shape.workspace': ({ file }: { file: string | null }) => r(`A workspace of packages (${file ?? 'workspaces in package.json'}).`),
  'shape.single': ({ file }: { file: string }) => r(`A single package (${file}).`),
  'shape.unknown': () => r('No package manifest or workspace file at the root, so the shape of the project is not known from files.', 'If the project is a monorepo, say so in AGENTS.md.'),

  'sessions.found': ({ count, name, where }: { count: number; name: string; where: string }) =>
    r(`${count} ${name} session${count === 1 ? '' : 's'} for this repository under ${where}, so usage could be attributed.`),
  'sessions.none': ({ name, where, env }: { name: string; where: string; env: string }) =>
    r(
      `No sessions for this repository under ${where}. No work has been recorded yet, or ${name} keeps its sessions elsewhere.`,
      `Nothing to do for a new project. If ${name} keeps its sessions elsewhere, point ${env} at them.`,
    ),
  'export.no-daemon': ({ name }: { name: string }) =>
    r(`The Binnacle daemon is not running and BINNACLE_PORT is 0, so whether ${name} exports to it cannot be told.`, 'Start the daemon, then run binn audit again.'),
  'export.binnacle': ({ name, address, where }: { name: string; address: string; where: string }) => r(`${name} exports OpenTelemetry to Binnacle at ${address}, in ${where}.`),
  'export.none': ({ name, where }: { name: string; where: string }) =>
    r(
      `${name} does not export OpenTelemetry (${where}), so Binnacle sees its calls only once its session files are written.`,
      `Run binn init, which shows the export it would add to ${where} and writes it only after you confirm.`,
    ),
  'export.elsewhere': ({ name, where, what, address }: { name: string; where: string; what: string; address: string }) =>
    r(
      `${name} has OpenTelemetry settings of its own (${where}: ${what}), which do not export to Binnacle at ${address}.`,
      `binn init leaves OpenTelemetry settings of a harness's own alone. If Binnacle should receive ${name}'s calls, point its export at ${address} yourself.`,
    ),
  'export.unreadable': ({ name, where, why }: { name: string; where: string; why: string }) => r(`${where} cannot be read as ${name}'s settings: ${why}.`, `Fix ${where}; binn init prints the export to add to it.`),
  'export.cannot': ({ name, reason }: { name: string; harness: string; reason: string }) => r(`${name} does not export to Binnacle: ${reason}.`),

  'docker.none': () => r('No container file is tracked (a Dockerfile, a Containerfile or a compose file), so the project has no container setup to check.'),
  'docker.ok': ({ containers, ignores }: { containers: string[]; ignores: string[] }) =>
    r(`${containers.join(', ')}: ${ignores.join(' and ')} exclude${ignores.length === 1 ? 's' : ''} .env and .git.`),
  'docker.gap': ({ containers, problems }: { containers: string[]; problems: IgnoreProblem[] }) => {
    const reasons = problems.map(({ ignore, missing }) =>
      missing === null
        ? `no tracked ${ignore}, so docker build sends the whole directory, .env and .git included`
        : `${ignore} does not exclude ${missing.join(' or ')}, so docker build sends ${missing.length === 1 ? 'it' : 'them'}`,
    );
    const advice = problems
      .map(({ ignore, missing }) => (missing === null ? `add ${ignore} with a line for .env and a line for .git` : `add a line for ${missing.join(' and a line for ')} to ${ignore}`))
      .join('; ');
    return r(`${containers.join(', ')}: ${reasons.join('; ')}.`, `${advice[0]!.toUpperCase()}${advice.slice(1)}.`);
  },

  'secrets.env': ({ path, quoted }: { path: string; quoted: string }) =>
    r(
      `${path} is tracked: an environment file holds secrets whatever it holds today, and every clone gets it.`,
      `Stop tracking it with git rm --cached -- ${quoted}, add it to .gitignore, rotate every key it held, and commit a .env.example without values instead. ${HISTORY}`,
    ),
  'secrets.token': ({ path, line, kind }: { path: string; line: number; kind: string }) =>
    r(`${path}:${line}: a token in the format of the ${kind}; the value is not shown.`, `Remove it from ${path}, and rotate the key at its provider: deleting the line does not revoke it. ${HISTORY}`),
  'secrets.none': ({ read, skipped, limit }: { read: number; skipped: number; limit: number }) =>
    r(`No known token format and no .env file in the ${read} tracked text files read (${skipped} skipped: binary, over ${limit} MiB or not a regular file).`),

  'lockfile.ok': ({ count, used }: { count: number; used: string[] }) =>
    r(`${count} package manifest${count === 1 ? '' : 's'}, each with a tracked lockfile in its directory or above it: ${used.join(', ')}.`),
  'lockfile.missing': ({ bare, choices }: { bare: string[]; choices: string[][] }) =>
    r(
      `No tracked lockfile for ${bare.join(', ')}, so every install resolves the dependencies afresh, and two installs of the same commit can differ.`,
      `Install with the project's package manager and commit the lockfile it writes, beside the manifest or at the workspace's root: ${choices.map((names) => names.join(' or ')).join('; ')}.`,
    ),
  'updates.ok': ({ where }: { where: string | null }) => r(`Dependency updates are configured: ${where ?? 'package.json, its renovate key'}.`),
  'updates.none': () =>
    r(
      'No Dependabot or Renovate configuration is tracked, so a dependency, and the fix for a vulnerability in it, is updated only when someone thinks of it.',
      'Add .github/dependabot.yml for Dependabot on GitHub, or a renovate.json for Renovate, which also runs on GitLab and other forges.',
    ),
  'policy.ok': ({ path }: { path: string }) => r(`A security policy: ${path}.`),
  'policy.none': () =>
    r(
      'No SECURITY.md at the root, in .github/ or in docs/. It tells whoever finds a vulnerability how to report it privately instead of in a public issue, which matters once the repository is public.',
      "Add SECURITY.md saying how to report a vulnerability privately, by an address or through the forge's private reporting, and which versions get fixes.",
    ),
};

type FindingWords = typeof en;

/** Why Binnacle's skills are stale, in Russian: which differ from this package's version, and which are missing. */
export const staleRu = ({ differ, missing, version }: Omit<Stale, 'where' | 'reason'>): string =>
  [
    differ.length > 0 ? `${differ.map(({ skill, version: at }) => `${skill} (${at === null ? 'без версии' : `версия ${at}`})`).join(', ')} не совпадают с версией этого пакета ${version}` : '',
    missing.length > 0 ? `${missing.join(', ')} отсутству${missing.length === 1 ? 'ет' : 'ют'}` : '',
  ]
    .filter(Boolean)
    .join(', а ');

const HISTORY_RU = 'Если коммит хоть раз пушили, значение осталось в истории Git, и переписывать ли её — решать вам. Аудит читает только отслеживаемые файлы в их нынешнем виде; историю сканирует gitleaks.';

/** Why a harness exports nothing to Binnacle, by its code, in Russian; one not listed keeps its English, marked. */
export const NO_EXPORT_RU: Record<string, string> = {
  opencode: 'opencode не документирует экспорт OpenTelemetry, поэтому Binnacle считает его только по его базе данных, каждый вызов — после его завершения',
  zcode: 'ZCode не документирует экспорт OpenTelemetry, поэтому Binnacle считает его только по его базе данных, каждый вызов — после его завершения',
  antigravity:
    'у Antigravity нет экспорта OpenTelemetry, а разговоры он хранит зашифрованными, поэтому Binnacle видит только его сессии и их каталоги, по состоянию его окна, без модели и без числа токенов',
  pi: 'у pi нет встроенного экспорта OpenTelemetry, поэтому Binnacle считает его только по файлам сессий, каждый вызов — после его завершения',
  vscode: 'Binnacle не настраивает экспорт OpenTelemetry для VS Code и не читает его сессии',
};

const ru: FindingWords = {
  'git.repository': ({ branch, empty }) => r(`Git-репозиторий, ${branch === null ? 'отсоединённый HEAD' : `ветка ${branch}${empty ? ' (коммитов ещё нет)' : ''}`}.`),
  'manifest.present': ({ path }) => r(`${path} на месте.`),
  'manifest.missing': ({ path }) =>
    r(`${path} нет, поэтому у Binnacle нет описания этого проекта.`, 'Запустите binn init: он покажет файл, который создаст, и запишет его только после вашего подтверждения.'),
  'provider.local': () => r('Удалённого репозитория нет, значит, нет и удалённого трекера. Локальные тикеты в docs/specs/ — тоже трекер, и Binnacle его читает.'),
  'provider.unrecognised': ({ remote }) =>
    r(
      `Удалённый репозиторий ${remote} по URL не распознан как GitHub или GitLab, поэтому Binnacle будет читать локальные тикеты в docs/specs/.`,
      'Если это GitHub или GitLab на собственном сервере, объявите его в разделе tracker файла .binnacle/project.yaml.',
    ),
  'provider.forge': ({ provider, repository, host }) => r(`Удалённый репозиторий указывает на трекер ${provider}: ${repository} на ${host}.`),
  'token.unusable': ({ failure }) => r(russian(failure), 'Исправьте токен, как сказано в этом сообщении.'),
  'token.none': ({ variable, host }) =>
    r(
      `Нет токена трекера: ${variable} не задана, а в файле учётных данных нет записи для ${host}.`,
      'Публичному репозиторию токен не нужен. Для приватного дайте Binnacle токен только для чтения (docs/operations/05-installation-checklist.ru.md, раздел «Учётные данные tracker»).',
    ),
  'token.present': () => r('Токен трекера есть, в окружении или в файле учётных данных. Его значение не показывается.'),
  'token.works': () => r('Работает ли токен, можно узнать только по сети, а аудит в сеть не ходит.', 'Запустите binn init: он один раз прочитает трекер и скажет, удалось ли.'),
  'worktree.unset': () => r('extensions.worktreeConfig не задан.'),
  'worktree.unreadable': () =>
    r('Git не смог прочитать extensions.worktreeConfig или общий каталог Git.', 'Запустите в репозитории git config --local --bool --get extensions.worktreeconfig, чтобы узнать почему.'),
  'worktree.used': ({ path }) => r(`extensions.worktreeConfig задан, и его использует ${path}.`),
  'worktree.unused': () =>
    r(
      'extensions.worktreeConfig задан, но ни один config.worktree его не использует — ни в общем каталоге Git, ни в каком-либо worktree. Git его не замечает, а Git-библиотека Antigravity отказывается открывать такой репозиторий, поэтому агент Antigravity в нём работать не может.',
      'Снимите его командой git config --unset extensions.worktreeconfig; его никто не читает, так что больше ничего не изменится.',
    ),

  exists: ({ path }) => r(`${path} на месте.`),
  'context.missing': () => r('Нет CONTEXT.md — словаря предметной области, который агент читает первым.', 'Напишите CONTEXT.md; /grill-with-docs собирает его по мере того, как термины согласуются.'),
  'adr.missing': () => r('Нет docs/adr: архитектурные решения не записаны.', 'Записывайте долгосрочные компромиссы как ADR в docs/adr.'),
  'docs.missing': () => r('Нет docs: нет каталога для долговременной документации.', 'Храните долговременные знания в Markdown в docs/.'),
  'roadmap.unknown': ({ manifest }) => r(`${manifest} не читается как манифест, поэтому неизвестно, где роадмап (knowledge.docs).`, `Исправьте ${manifest}; binn init назовёт его проблемы.`),
  'roadmap.undeclared': ({ manifest }) => r(`В ${manifest} не задан knowledge.docs, поэтому Binnacle не читает роадмап.`, `Задайте в ${manifest} knowledge.docs — каталог, чей roadmap.md и есть роадмап.`),
  'roadmap.missing': ({ path }) =>
    r(
      `Роадмапа ${path} нет, поэтому Binnacle не показывает, где стоит проект, и не предлагает следующий шаг.`,
      'Запустите binn init: он предложит заготовку роадмапа в формате Binnacle и запишет её только после вашего подтверждения.',
    ),
  'roadmap.ok': ({ path }) => r(`${path} — в формате Binnacle.`),
  'roadmap.format': ({ path, gaps }) =>
    r(`${path} не в формате Binnacle. ${gaps.map(russian).join(' ')}`, `Приведите ${path} к формату вручную, сохранив содержимое; binn init никогда не переписывает существующий роадмап.`),
  'ls-files.failed': ({ what }) =>
    r(
      `git ls-files не сработал, поэтому неизвестно, ${{ documents: 'какие документы', containers: 'какие файлы контейнеров', files: 'какие файлы' }[what]} отслеживаются.`,
      'Запустите в репозитории git ls-files, чтобы узнать почему.',
    ),
  'stranded.none': () => r('Ни один отслеживаемый документ вне мест Binnacle не называется планом, спецификацией, решением, заметками или роадмапом.'),
  'stranded.found': ({ paths }) =>
    r(`Бесхозные документы вне мест Binnacle; куда отнести каждый — решать вам: ${paths.join(', ')}.`, 'Запустите /binnacle:roadmap: он предложит место для каждого и ничего не переместит без вашего «да».'),

  'layout.ok': ({ present, specs }) => r(`Раскладка на месте: ${present.join(', ')} и ${counted(specs, ['спецификация', 'спецификации', 'спецификаций'])} в docs/specs/.`),
  'layout.none': ({ missing }) => r(`Раскладки Matt Pocock нет: не хватает всего — ${missing.join(', ')}.`, 'Запустите binn init: он запишет файлы соглашений; каталоги спецификаций пишет /to-spec.'),
  'layout.partial': ({ present, missing }) =>
    r(
      `Раскладка Matt Pocock неполная. Есть: ${present.join(', ')}. Нет: ${missing.join(', ')}.`,
      'Добавьте только недостающее: binn init запишет недостающие файлы соглашений, а /to-spec — каталоги спецификаций.',
    ),
  'header.ok': ({ path }) => r(`В ${path} есть раздел о заголовке тикета.`),
  'header.missing': ({ path, file }) =>
    r(
      `В ${path} нет соглашения о заголовке тикета${file ? '' : ' (самого файла нет)'}, а по нему Binnacle читает состояние тикета и его зависимости (ADR-0024).`,
      `Запустите binn init: он предложит ${file ? 'добавить раздел' : 'файл с этим разделом'}.`,
    ),

  'scratch.none': () => r('Каталога .scratch нет, проверять нечего.'),
  'scratch.exists': () => r('.scratch есть.'),
  'scratch.ignored': () => r('Git игнорирует .scratch.'),
  'scratch.unignored': () => r('Git не игнорирует .scratch, поэтому его рабочие файлы можно закоммитить по ошибке.', 'Добавьте .scratch/ в .gitignore.'),
  'scratch.clean': () => r('В .scratch нет спецификаций и тикетов, которых не было бы и в docs/specs/.'),
  'scratch.durable': ({ paths }) =>
    r(
      `В .scratch, похоже, лежит единственная копия спецификации или тикета: ${paths.join(', ')}.`,
      'Перенесите каждую в Git — спецификацию в docs/specs/<slug>/, её тикеты в docs/specs/<slug>/issues/, — пока удаление worktree их не потеряло.',
    ),

  'tool.declared': ({ manifest, title, use }) =>
    r(`${manifest} объявляет, что ${title} ${{ installed: 'установлен', optional: 'необязателен', unused: 'не используется' }[use]}. Объявление принимается как есть.`),
  'tool.found': ({ title, where }) => r(`${title}, похоже, настроен: найден в ${where}.`),
  'tool.missing': ({ title, looked, user, manifest }) =>
    r(
      `Настройка ${title} не найдена ни в ${looked} (репозиторий), ни в ${user} (уровень пользователя). Возможно, ${title} настроен где-то ещё.`,
      `Если агенту здесь нужен ${title}, объявите его в разделе capabilities файла ${manifest}.`,
    ),
  'skills.stale': (stale) =>
    r(
      `Скиллы Binnacle в ${stale.where} устарели: ${staleRu(stale)}. Каждый клиент агента, куда их поставил skills CLI, запускает старые.`,
      'Запустите binn init и подтвердите его план: он заново поставит скиллы Binnacle.',
    ),

  'instructions.none': () => r('Нет ни AGENTS.md, ни CLAUDE.md: первый агент начнёт без инструкций.', 'Напишите AGENTS.md; если Claude Code нужен свой файл, пусть CLAUDE.md содержит @AGENTS.md.'),
  'instructions.one': ({ sets }) => r(`Один набор инструкций: ${setsRu(sets)}.`),
  'instructions.two': ({ sets }) =>
    r(`Два файла инструкций, которые не импортируют друг друга: ${setsRu(sets)}. Агент может прочитать две правды.`, 'Решите, какой из них главный, и пусть другой его импортирует (CLAUDE.md с @AGENTS.md).'),

  'tests.found': ({ script, files }) => r(`Тесты настроены: ${[...(script ? ['тестовый скрипт в package.json'] : []), ...files].join(', ')}. Они не запускались.`),
  'tests.none': () => r('Тесты не найдены: нет ни тестового скрипта, ни конфигурации тестов, ни каталога с тестами.', 'Добавьте тесты и команду, которая их запускает, чтобы изменение можно было проверить.'),
  'ci.found': ({ files }) => r(`Конфигурация CI: ${files.join(', ')}. Она не запускалась.`),
  'ci.none': () => r('Конфигурация CI не найдена.', 'Добавьте пайплайн CI, который запускает тесты на каждый push.'),
  'shape.workspace': ({ file }) => r(`Рабочее пространство из нескольких пакетов (${file ?? 'workspaces в package.json'}).`),
  'shape.single': ({ file }) => r(`Один пакет (${file}).`),
  'shape.unknown': () => r('В корне нет ни манифеста пакета, ни файла рабочего пространства, поэтому по файлам не понять, как устроен проект.', 'Если проект — монорепозиторий, напишите об этом в AGENTS.md.'),

  'sessions.found': ({ count, name, where }) =>
    r(`${counted(count, ['сессия', 'сессии', 'сессий'])} ${name} этого репозитория в ${where}, так что расход можно отнести к нему.`),
  'sessions.none': ({ name, where, env }) =>
    r(
      `В ${where} нет сессий этого репозитория. Либо работы ещё не было, либо ${name} хранит сессии в другом месте.`,
      `Для нового проекта делать ничего не нужно. Если ${name} хранит сессии в другом месте, укажите путь к ним в ${env}.`,
    ),
  'export.no-daemon': ({ name }) =>
    r(`Демон Binnacle не запущен, а BINNACLE_PORT равен 0, поэтому нельзя сказать, экспортирует ли ${name} в него.`, 'Запустите демон и снова выполните binn audit.'),
  'export.binnacle': ({ name, address, where }) => r(`${name} экспортирует OpenTelemetry в Binnacle по адресу ${address}, настройка — в ${where}.`),
  'export.none': ({ name, where }) =>
    r(
      `${name} не экспортирует OpenTelemetry (${where}), поэтому Binnacle видит его вызовы только после того, как записаны файлы сессий.`,
      `Запустите binn init: он покажет экспорт, который добавит в ${where}, и запишет его только после вашего подтверждения.`,
    ),
  'export.elsewhere': ({ name, where, what, address }) =>
    r(
      `У ${name} свои настройки OpenTelemetry (${where}: ${what} (англ.)), и они не экспортируют в Binnacle по адресу ${address}.`,
      `binn init не трогает собственные настройки OpenTelemetry клиента агента. Если Binnacle должен получать вызовы ${name}, направьте его экспорт на ${address} сами.`,
    ),
  'export.unreadable': ({ name, where, why }) => r(`${where} не читается как настройки ${name}: ${why} (англ.).`, `Исправьте ${where}; binn init напечатает экспорт, который нужно туда добавить.`),
  'export.cannot': ({ name, harness, reason }) => r(`${name} не экспортирует в Binnacle: ${NO_EXPORT_RU[harness] ?? `${reason} (англ.)`}.`),

  'docker.none': () => r('Ни один файл контейнера не отслеживается (ни Dockerfile, ни Containerfile, ни compose-файл), так что настройки контейнеров для проверки нет.'),
  'docker.ok': ({ containers, ignores }) => r(`${containers.join(', ')}: ${ignores.join(' и ')} исключа${ignores.length === 1 ? 'ет' : 'ют'} .env и .git.`),
  'docker.gap': ({ containers, problems }) => {
    const reasons = problems.map(({ ignore, missing }) =>
      missing === null
        ? `отслеживаемого ${ignore} нет, поэтому docker build отправляет весь каталог вместе с .env и .git`
        : `${ignore} не исключает ${missing.join(' и ')}, поэтому docker build ${missing.length === 1 ? 'его' : 'их'} отправляет`,
    );
    const advice = problems
      .map(({ ignore, missing }) => (missing === null ? `добавьте ${ignore} со строкой для .env и строкой для .git` : `добавьте в ${ignore} строку для ${missing.join(' и строку для ')}`))
      .join('; ');
    return r(`${containers.join(', ')}: ${reasons.join('; ')}.`, `${advice[0]!.toUpperCase()}${advice.slice(1)}.`);
  },

  'secrets.env': ({ path, quoted }) =>
    r(
      `${path} отслеживается: файл окружения хранит секреты, что бы в нём ни лежало сейчас, и попадает в каждый клон.`,
      `Перестаньте его отслеживать командой git rm --cached -- ${quoted}, добавьте его в .gitignore, смените каждый ключ, который в нём был, и закоммитьте вместо него .env.example без значений. ${HISTORY_RU}`,
    ),
  'secrets.token': ({ path, line, kind }) =>
    r(`${path}:${line}: токен в формате ${kind}; значение не показывается.`, `Удалите его из ${path} и смените ключ у провайдера: удаление строки ключ не отзывает. ${HISTORY_RU}`),
  'secrets.none': ({ read, skipped, limit }) =>
    r(`Прочитано отслеживаемых текстовых файлов: ${read}; ни известного формата токена, ни файла .env в них нет (пропущено: ${skipped} — двоичные, больше ${limit} МиБ или не обычные файлы).`),

  'lockfile.ok': ({ count, used }) => r(`Манифестов пакетов: ${count}, у каждого есть отслеживаемый lockfile в его каталоге или выше: ${used.join(', ')}.`),
  'lockfile.missing': ({ bare, choices }) =>
    r(
      `Для ${bare.join(', ')} нет отслеживаемого lockfile, поэтому каждая установка заново подбирает зависимости, и две установки одного коммита могут различаться.`,
      `Установите зависимости менеджером пакетов проекта и закоммитьте lockfile, который он запишет, рядом с манифестом или в корне рабочего пространства: ${choices.map((names) => names.join(' или ')).join('; ')}.`,
    ),
  'updates.ok': ({ where }) => r(`Обновления зависимостей настроены: ${where ?? 'package.json, ключ renovate'}.`),
  'updates.none': () =>
    r(
      'Конфигурация ни Dependabot, ни Renovate не отслеживается, поэтому зависимость, а с ней и исправление уязвимости в ней, обновляется, только когда кто-то об этом вспомнит.',
      'Добавьте .github/dependabot.yml для Dependabot на GitHub или renovate.json для Renovate, который работает и на GitLab, и на других платформах.',
    ),
  'policy.ok': ({ path }) => r(`Политика безопасности: ${path}.`),
  'policy.none': () =>
    r(
      'Нет SECURITY.md ни в корне, ни в .github/, ни в docs/. Он говорит тому, кто нашёл уязвимость, как сообщить о ней приватно, а не в публичном issue, — это важно, когда репозиторий публичный.',
      'Добавьте SECURITY.md: как сообщить об уязвимости приватно — по адресу или через приватные отчёты платформы — и какие версии получают исправления.',
    ),
};

/** The instruction sets as one sentence part, in Russian, as `describeSets` writes them in English. */
export const setsRu = (sets: string[][]): string => sets.map(([entry, ...imported]) => (imported.length === 0 ? entry : `${entry}, который импортирует ${imported.join(' и ')}`)).join('; ');

const FINDING_WORDS: Record<Language, FindingWords> = { en, ru };

type Key = keyof FindingWords;
/** A finding's wording: its key and the values it is written from. */
export type Worded = { [K in Key]: { key: K; params: Parameters<FindingWords[K]>[0] } }[Key];

/** What a check found, before it is worded: the finding's fields but its reason and recommendation, and its wording. */
export type Check = Omit<Finding, 'reason' | 'recommendation'> & { words: Worded };

/** The wording `key` with its values, for a check to carry. */
export const words = <K extends Key>(key: K, ...params: Parameters<FindingWords[K]>): { words: Worded } => ({ words: { key, params: params[0] } as Worded });

/** A check's reason and recommendation in `language`. */
export const word = (language: Language, { words: { key, params } }: Check): Wording => (FINDING_WORDS[language][key] as (params: unknown) => Wording)(params);

/** The report around the findings, and the plan's titles: English in `--json`, the person's language in the text. */
const reportEn = {
  areas: {
    'git-and-tracker': 'Git and tracker',
    docs: 'Docs',
    'matt-pocock-layout': 'Matt Pocock layout',
    scratch: '.scratch',
    capabilities: 'Capabilities',
    instructions: 'Instructions',
    structure: 'Structure',
    telemetry: 'Telemetry',
    docker: 'Docker',
    secrets: 'Secrets',
    security: 'Security',
  } as Record<AuditArea, string>,
  status: { ok: 'ok', gap: 'gap', unknown: 'unknown' } as Record<Finding['status'], string>,
  totals: (root: string, { ok, gap, unknown }: Record<Finding['status'], number>, steps: number) =>
    `Audit of ${root}: ${ok} ok, ${gap} gap${gap === 1 ? '' : 's'}, ${unknown} unknown; ${steps === 0 ? 'nothing to do' : `${steps} step${steps === 1 ? '' : 's'} in the migration plan`}.`,
  plan: 'Migration plan',
  gaps: 'Gaps and unknowns',
  ok: 'In order',
  recommendation: 'Recommendation',
  notGit: (reason: string) => `${reason} binn audit works on a Git repository.`,
  init: 'Run binn init',
  initTodo: 'Run binn init: it shows one plan of every file it writes and every tool it installs, and changes nothing until you confirm it.',
  secrets: 'Deal with the committed secrets',
  secretsTodo:
    "Remove each value and stop tracking each environment file, as each finding's recommendation says, then rotate every key at its provider: deleting a line revokes nothing. If a commit holding one was ever pushed, rewriting Git's history is your decision; gitleaks scans the history, which the audit does not read.",
  summary: (steps: number) => (steps === 0 ? 'Nothing to do: every finding is ok.' : `${steps} step${steps === 1 ? '' : 's'}, in order. Each is yours to carry out; the audit runs none.`),
};

const reportRu: typeof reportEn = {
  areas: {
    'git-and-tracker': 'Git и трекер',
    docs: 'Документация',
    'matt-pocock-layout': 'Раскладка Matt Pocock',
    scratch: '.scratch',
    capabilities: 'Инструменты',
    instructions: 'Инструкции агентов',
    structure: 'Структура проекта',
    telemetry: 'Телеметрия',
    docker: 'Docker',
    secrets: 'Секреты',
    security: 'Безопасность',
  },
  status: { ok: 'в порядке', gap: 'пробел', unknown: 'неизвестно' },
  totals: (root, { ok, gap, unknown }, steps) =>
    `Аудит ${root}: в порядке — ${ok}, пробелов — ${gap}, неизвестно — ${unknown}; ${steps === 0 ? 'делать ничего не нужно' : `шагов в плане перехода — ${steps}`}.`,
  plan: 'План перехода',
  gaps: 'Пробелы и неизвестное',
  ok: 'В порядке',
  recommendation: 'Рекомендация',
  notGit: (reason) => `${reason} binn audit работает в Git-репозитории.`,
  init: 'Запустить binn init',
  initTodo: 'Запустите binn init: он покажет один план — каждый файл, который запишет, и каждый инструмент, который поставит, — и ничего не изменит, пока вы его не подтвердите.',
  secrets: 'Разобраться с закоммиченными секретами',
  secretsTodo:
    'Удалите каждое значение и перестаньте отслеживать каждый файл окружения, как сказано в рекомендации каждой находки, затем смените каждый ключ у его провайдера: удаление строки ничего не отзывает. Если коммит с таким значением хоть раз пушили, переписывать ли историю Git — решать вам; историю, которую аудит не читает, сканирует gitleaks.',
  summary: (steps) => (steps === 0 ? 'делать ничего не нужно, все находки в порядке.' : `${counted(steps, ['шаг', 'шага', 'шагов'])} по порядку. Каждый шаг выполняете вы; аудит сам ничего не запускает.`),
};

export const REPORT_WORDS: Record<Language, typeof reportEn> = { en: reportEn, ru: reportRu };
