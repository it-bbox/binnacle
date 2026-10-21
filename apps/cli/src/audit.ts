import { readGitFacts, readGitLocation, type GitFacts } from '@binnacle/adapters';
import { AUDIT_AREAS, forgeRemote, instructionSets, type AuditArea, type Finding, type Language } from '@binnacle/core';
import { MANIFEST_RELATIVE, OperationError, readManifest, resolveGitTimeout, trackerToken } from '@binnacle/daemon';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { docker, scratch, secrets, security, stranded, structure } from './audit-files.ts';
import { REPORT_WORDS, word, words, type Check } from './audit-text.ts';
import { capabilities, telemetry, telemetryExport } from './audit-tools.ts';
import { EXIT, type ExitCode } from './exit.ts';
import { LANGUAGE } from './language.ts';
import { hasTicketHeaderSection, instructionFiles, ISSUE_TRACKER, MATT_POCOCK_FILES, mattPocockFiles, roadmapGaps, specSlugs } from './layout.ts';
import { say } from './text.ts';

type Repository = Extract<GitFacts, { available: true }>;

/**
 * `binn audit [path]`: findings about the Git repository containing `path`, as text or JSON.
 * It reads and never writes (ADR-0020), makes no network call and runs nothing but Git. Gaps
 * leave the exit code at 0; it fails only when the audit could not run. `--json` is English
 * whatever the locale; the text is in the person's language and leads with what to do.
 */
export async function audit(home: string, path: string | undefined, json: boolean): Promise<ExitCode> {
  const git = await readGitFacts(resolve(path ?? process.cwd()), resolveGitTimeout());
  if (!git.available) {
    console.error(`binn: ${REPORT_WORDS[LANGUAGE].notGit(say({ code: git.code, message: git.reason, params: git.params }))}`);
    return EXIT.failed;
  }

  // One list per area, so that each later area is one more entry here; the sort is stable, so checks keep their order within an area.
  const all: Check[] = [...gitAndTracker(git, home), await worktreeConfig(git.root), ...docs(git.root), ...mattPocockLayout(git.root), ...scratch(git.root), ...capabilities(git.root), ...instructions(git.root), ...structure(git.root), ...(await telemetry(git.root)), ...telemetryExport(home), ...docker(git.root), ...secrets(git.root), ...security(git.root)]
    .sort((a, b) => AUDIT_AREAS.indexOf(a.area) - AUDIT_AREAS.indexOf(b.area))
    .map((check) => ({ ...check, init: check.init ?? false }));

  if (json) {
    const findings: Finding[] = all.map((check) => {
      const { reason, recommendation } = word('en', check);
      return { code: check.code, area: check.area, status: check.status, init: check.init!, reason, ...(recommendation === undefined ? {} : { recommendation }) };
    });
    const { en } = REPORT_WORDS;
    const steps = migrationPlan(all).map(({ kind, checks }, at) => ({
      number: at + 1,
      title: kind === 'init' ? en.init : kind === 'secrets' ? en.secrets : `The ${kind} area`,
      findings: [...new Set(checks.map(({ code }) => code))],
      todo: todo('en', kind, checks),
    }));
    console.log(JSON.stringify({ root: git.root, findings, plan: { steps, summary: en.summary(steps.length) } }, null, 2));
  } else {
    console.log(report(git.root, all, LANGUAGE));
  }
  return EXIT.ok;
}

/** A plan's step: binn init's, the secrets', or one area's, with its findings. */
type Step = { kind: 'init' | 'secrets' | AuditArea; checks: Check[] };

/**
 * The migration plan (CONTEXT.md): every finding not `ok` that `binn init` closes, then the secrets, then one step per area
 * in the areas' order, its gaps before its unknowns. A step with nothing to do is left out. It is advice: nothing is run.
 */
function migrationPlan(all: Check[]): Step[] {
  const open = all.filter(({ status }) => status !== 'ok');
  const steps: Step[] = [
    { kind: 'init', checks: open.filter(({ init }) => init) },
    { kind: 'secrets', checks: open.filter(({ init, area }) => !init && area === 'secrets') },
    ...AUDIT_AREAS.filter((area) => area !== 'secrets').map((area): Step => {
      const mine = open.filter((check) => !check.init && check.area === area);
      return { kind: area, checks: [...mine.filter(({ status }) => status === 'gap'), ...mine.filter(({ status }) => status === 'unknown')] };
    }),
  ];
  return steps.filter(({ checks }) => checks.length > 0);
}

/** What a step asks: binn init's and the secrets' own words, an area's recommendations once each. */
function todo(language: Language, kind: Step['kind'], checks: Check[]): string {
  const words = REPORT_WORDS[language];
  if (kind === 'init') return words.initTodo;
  if (kind === 'secrets') return words.secretsTodo;
  return [...new Set(checks.map((check) => word(language, check).recommendation))].join(' ');
}

/**
 * The text: one line of totals, then the plan, its steps naming their areas, then the gaps and unknowns by area, each
 * with its reason and recommendation, then each `ok` in a line. No finding's code is in it.
 */
function report(root: string, all: Check[], language: Language): string {
  const words = REPORT_WORDS[language];
  const area = (name: AuditArea) => words.areas[name];
  const steps = migrationPlan(all);
  const count = (status: Finding['status']) => all.filter((check) => check.status === status).length;
  const lines = [words.totals(root, { ok: count('ok'), gap: count('gap'), unknown: count('unknown') }, steps.length), '', `${words.plan}: ${words.summary(steps.length)}`];
  steps.forEach(({ kind, checks }, at) => {
    const title =
      kind === 'init'
        ? `${words.init} (${AUDIT_AREAS.filter((name) => checks.some((check) => check.area === name))
            .map(area)
            .join(', ')})`
        : kind === 'secrets'
          ? words.secrets
          : area(kind);
    lines.push(`${at + 1}. ${title}`, `    ${todo(language, kind, checks)}`);
  });
  const open = all.filter(({ status }) => status !== 'ok');
  if (open.length > 0) {
    lines.push('', words.gaps);
    for (const name of AUDIT_AREAS) {
      const mine = open.filter((check) => check.area === name);
      if (mine.length === 0) continue;
      lines.push(area(name));
      for (const check of mine) {
        const { reason, recommendation } = word(language, check);
        lines.push(`  ${words.status[check.status]}: ${reason}`, `    ${words.recommendation}: ${recommendation}`);
      }
    }
  }
  const ok = all.filter(({ status }) => status === 'ok');
  if (ok.length > 0) lines.push('', words.ok, ...ok.map((check) => `  ${area(check.area)}: ${word(language, check).reason}`));
  return lines.join('\n');
}

/** Whether this is a repository, on what branch, which tracker its remote names and whether a token for it exists. */
function gitAndTracker(git: Repository, home: string): Check[] {
  const area = 'git-and-tracker';
  const found: Check[] = [{ code: 'git.repository', area, status: 'ok', ...words('git.repository', { branch: git.detached ? null : git.branch, empty: git.commit === null }) }];
  // A Binnacle file, and the one that declares the tracker: its absence is what `binn init` answers.
  found.push(
    existsSync(join(git.root, MANIFEST_RELATIVE))
      ? { code: 'binnacle.manifest', area, status: 'ok', ...words('manifest.present', { path: MANIFEST_RELATIVE }) }
      : { code: 'binnacle.manifest', area, status: 'gap', init: true, ...words('manifest.missing', { path: MANIFEST_RELATIVE }) },
  );

  const forge = forgeRemote(git.remotes);
  if (!forge) {
    found.push(
      git.remotes.length === 0
        ? { code: 'tracker.provider', area, status: 'ok', ...words('provider.local') }
        : { code: 'tracker.provider', area, status: 'unknown', ...words('provider.unrecognised', { remote: git.remotes[0]!.name }) },
    );
    return found;
  }

  found.push({ code: 'tracker.provider', area, status: 'ok', ...words('provider.forge', { provider: forge.provider, repository: forge.repository, host: forge.host }) });
  // The daemon's own lookup, so that the two never disagree. Only its presence is used; the value goes no further.
  const token = trackerToken(home, forge.provider, forge.host === `${forge.provider}.com` ? null : forge.host);
  if ('failure' in token) {
    found.push({ code: 'tracker.token', area, status: 'gap', ...words('token.unusable', { failure: token.failure }) });
  } else if (token.token === null) {
    found.push({ code: 'tracker.token', area, status: 'gap', ...words('token.none', { variable: `BINNACLE_${forge.provider.toUpperCase()}_TOKEN`, host: forge.host }) });
  } else {
    found.push({ code: 'tracker.token', area, status: 'ok', ...words('token.present') });
  }
  found.push({ code: 'tracker.token_works', area, status: 'unknown', ...words('token.works') });
  return found;
}

/**
 * `extensions.worktreeConfig` set with no `config.worktree` using it: the leftover of a worktree tool, harmless to Git and fatal
 * to a Git library that refuses an extension it does not know, as Antigravity's does. A `config.worktree` in the common Git
 * directory, the main worktree's, or under its `worktrees/`, a linked worktree's, makes the setting deliberate.
 */
async function worktreeConfig(root: string): Promise<Check> {
  const base = { code: 'git.worktree_config', area: 'git-and-tracker' } as const;
  // The repository's own config only: Git honours an extension nowhere else, and that is the file the unset command edits.
  const setting = spawnSync('git', ['config', '--local', '--bool', '--get', 'extensions.worktreeconfig'], { cwd: root, encoding: 'utf8', timeout: resolveGitTimeout() });
  // git config exits 1 for a key that is not set.
  if (setting.status === 1 || (setting.status === 0 && setting.stdout.trim() !== 'true')) return { ...base, status: 'ok', ...words('worktree.unset') };
  const location = setting.status === 0 ? await readGitLocation(root, resolveGitTimeout()) : null;
  if (!location) return { ...base, status: 'unknown', ...words('worktree.unreadable') };
  const dir = location.commonDir;
  let linked: string[] = [];
  try {
    linked = readdirSync(join(dir, 'worktrees')).map((name) => join(dir, 'worktrees', name, 'config.worktree'));
  } catch {
    // No linked worktree.
  }
  const used = [join(dir, 'config.worktree'), ...linked].find((path) => existsSync(path));
  if (used) return { ...base, status: 'ok', ...words('worktree.used', { path: used }) };
  return { ...base, status: 'gap', ...words('worktree.unused') };
}

/** Whether `CONTEXT.md`, an ADR directory and `docs/` exist, the roadmap, and the documents stranded outside Binnacle's places. */
function docs(root: string): Check[] {
  const area = 'docs';
  const declared = knowledgeDocs(root);
  const check = (code: string, path: string, missing: 'context.missing' | 'adr.missing' | 'docs.missing', init = false): Check =>
    existsSync(join(root, path)) ? { code, area, status: 'ok', ...words('exists', { path }) } : { code, area, status: 'gap', init, ...words(missing) };
  return [
    check('docs.context', 'CONTEXT.md', 'context.missing'),
    check('docs.adr', 'docs/adr', 'adr.missing'),
    // binn init writes its convention files under docs/agents/, which creates docs/.
    check('docs.docs', 'docs', 'docs.missing', true),
    roadmap(root, declared),
    // Without a usable declaration, the places are where binn init would declare them.
    stranded(root, declared ?? 'docs'),
  ];
}

/**
 * knowledge.docs: `docs` when there is no manifest, as `binn init` would declare; null when the manifest declares none;
 * undefined when it cannot be read, since a manifest with problems declares nothing that can be trusted.
 */
function knowledgeDocs(root: string): string | null | undefined {
  try {
    return readManifest(root).manifest.knowledge.docs;
  } catch (error) {
    return error instanceof OperationError && error.code === 'manifest.missing' ? 'docs' : undefined;
  }
}

/** The roadmap Binnacle reads, `<knowledge.docs>/roadmap.md` (ADR-0025). */
function roadmap(root: string, docs: string | null | undefined): Check {
  const base = { code: 'docs.roadmap', area: 'docs' } as const;
  if (docs === undefined) return { ...base, status: 'unknown', ...words('roadmap.unknown', { manifest: MANIFEST_RELATIVE }) };
  if (docs === null) return { ...base, status: 'gap', ...words('roadmap.undeclared', { manifest: MANIFEST_RELATIVE }) };
  const path = posix.join(docs, 'roadmap.md');
  let text: string;
  try {
    text = readFileSync(join(root, path), 'utf8');
  } catch {
    return { ...base, status: 'gap', init: true, ...words('roadmap.missing', { path }) };
  }
  const gaps = roadmapGaps(text);
  if (gaps.length === 0) return { ...base, status: 'ok', ...words('roadmap.ok', { path }) };
  return { ...base, status: 'gap', ...words('roadmap.format', { path, gaps }) };
}

/** The Matt Pocock layout: its convention files and a spec directory, and the ticket-header convention. */
function mattPocockLayout(root: string): Check[] {
  const area = 'matt-pocock-layout';
  const present = mattPocockFiles(root);
  const slugs = specSlugs(root);
  const missing = [...MATT_POCOCK_FILES.filter((path) => !present.includes(path)), ...(slugs.length === 0 ? ['docs/specs/<slug>/'] : [])];
  const found: Check[] = [];
  if (missing.length === 0) {
    found.push({ code: 'layout.files', area, status: 'ok', ...words('layout.ok', { present, specs: slugs.length }) });
  } else if (present.length + slugs.length === 0) {
    found.push({ code: 'layout.files', area, status: 'gap', init: true, ...words('layout.none', { missing }) });
  } else {
    found.push({
      code: 'layout.files',
      area,
      status: 'gap',
      // binn init writes the convention files; a spec directory alone is /to-spec's.
      init: present.length < MATT_POCOCK_FILES.length,
      ...words('layout.partial', { present: [...present, ...slugs.map((slug) => `docs/specs/${slug}/`)], missing }),
    });
  }
  found.push(
    hasTicketHeaderSection(root)
      ? { code: 'layout.ticket_header', area, status: 'ok', ...words('header.ok', { path: ISSUE_TRACKER }) }
      : { code: 'layout.ticket_header', area, status: 'gap', init: true, ...words('header.missing', { path: ISSUE_TRACKER, file: present.includes(ISSUE_TRACKER) }) },
  );
  return found;
}

/** AGENTS.md and CLAUDE.md as the sets an agent reads. */
function instructions(root: string): Check[] {
  const base = { code: 'instructions.sets', area: 'instructions' } as const;
  const sets = instructionSets(instructionFiles(root));
  // binn init writes an AGENTS.md holding its Agent skills block.
  if (sets.length === 0) return [{ ...base, status: 'gap', init: true, ...words('instructions.none') }];
  if (sets.length === 1) return [{ ...base, status: 'ok', ...words('instructions.one', { sets }) }];
  return [{ ...base, status: 'gap', ...words('instructions.two', { sets }) }];
}
