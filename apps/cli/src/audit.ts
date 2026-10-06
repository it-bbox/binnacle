import { readGitFacts, type GitFacts } from '@binnacle/adapters';
import { AUDIT_AREAS, forgeRemote, instructionSets, type Finding } from '@binnacle/core';
import { MANIFEST_RELATIVE, OperationError, readManifest, resolveGitTimeout, trackerToken } from '@binnacle/daemon';
import { existsSync, readFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { scratch, structure } from './audit-files.ts';
import { capabilities, telemetry } from './audit-tools.ts';
import { EXIT, type ExitCode } from './exit.ts';
import { describeSets, hasTicketHeaderSection, instructionFiles, ISSUE_TRACKER, MATT_POCOCK_FILES, mattPocockFiles, roadmapGaps, specSlugs } from './layout.ts';

type Repository = Extract<GitFacts, { available: true }>;

/**
 * `binn audit [path]`: findings about the Git repository containing `path`, as text or JSON.
 * It reads and never writes (ADR-0020), makes no network call and runs nothing but Git. Gaps
 * leave the exit code at 0; it fails only when the audit could not run.
 */
export async function audit(home: string, path: string | undefined, json: boolean): Promise<ExitCode> {
  const git = await readGitFacts(resolve(path ?? process.cwd()), resolveGitTimeout());
  if (!git.available) {
    console.error(`binn: ${git.reason} binn audit works on a Git repository.`);
    return EXIT.failed;
  }

  // One list per area, so that each later area is one more entry here; the sort is stable, so checks keep their order within an area.
  const all: Finding[] = [...gitAndTracker(git, home), ...docs(git.root), ...mattPocockLayout(git.root), ...scratch(git.root), ...capabilities(git.root), ...instructions(git.root), ...structure(git.root), ...(await telemetry(git.root))].sort((a, b) => AUDIT_AREAS.indexOf(a.area) - AUDIT_AREAS.indexOf(b.area));

  if (json) {
    console.log(JSON.stringify({ root: git.root, findings: all }, null, 2));
  } else {
    console.log(`Audit of ${git.root}\n`);
    for (const { code, area, status, reason, recommendation } of all) {
      console.log(`[${status}] ${code} (${area})\n    ${reason}`);
      if (recommendation) console.log(`    Recommendation: ${recommendation}`);
    }
  }
  return EXIT.ok;
}

/** Whether this is a repository, on what branch, which tracker its remote names and whether a token for it exists. */
function gitAndTracker(git: Repository, home: string): Finding[] {
  const area = 'git-and-tracker';
  const branch = git.detached ? 'a detached HEAD' : `branch ${git.branch}${git.commit === null ? ' (no commit yet)' : ''}`;
  const found: Finding[] = [{ code: 'git.repository', area, status: 'ok', reason: `A Git repository, on ${branch}.` }];
  // A Binnacle file, and the one that declares the tracker: its absence is what `binn init` answers.
  found.push(
    existsSync(join(git.root, MANIFEST_RELATIVE))
      ? { code: 'binnacle.manifest', area, status: 'ok', reason: `${MANIFEST_RELATIVE} is present.` }
      : {
          code: 'binnacle.manifest',
          area,
          status: 'gap',
          reason: `${MANIFEST_RELATIVE} is missing, so Binnacle has no declaration of this project.`,
          recommendation: 'Run binn init, which shows the file it would create and writes it only after you confirm.',
        },
  );

  const forge = forgeRemote(git.remotes);
  if (!forge) {
    if (git.remotes.length === 0) {
      found.push({
        code: 'tracker.provider',
        area,
        status: 'ok',
        reason: 'No remote, so no remote tracker. Local tickets under docs/specs/ are a tracker Binnacle reads.',
      });
    } else {
      found.push({
        code: 'tracker.provider',
        area,
        status: 'unknown',
        reason: `The remote ${git.remotes[0]!.name} is not recognised as GitHub or GitLab from its URL, so Binnacle would read local tickets under docs/specs/.`,
        recommendation: 'If the remote is a self-hosted GitHub or GitLab, declare it in the tracker section of .binnacle/project.yaml.',
      });
    }
    return found;
  }

  found.push({ code: 'tracker.provider', area, status: 'ok', reason: `The remote names a ${forge.provider} tracker, ${forge.repository} on ${forge.host}.` });
  // The daemon's own lookup, so that the two never disagree. Only its presence is used; the value goes no further.
  const token = trackerToken(home, forge.provider, forge.host === `${forge.provider}.com` ? null : forge.host);
  if ('failure' in token) {
    found.push({ code: 'tracker.token', area, status: 'gap', reason: token.failure.message, recommendation: 'Fix the token as that message says.' });
  } else if (token.token === null) {
    found.push({
      code: 'tracker.token',
      area,
      status: 'gap',
      reason: `No tracker token: BINNACLE_${forge.provider.toUpperCase()}_TOKEN is not set and the credentials file has no entry for ${forge.host}.`,
      recommendation: 'A public repository needs none. For a private one, give Binnacle a read-only token (docs/operations/05-installation-checklist.md, Tracker credentials).',
    });
  } else {
    found.push({ code: 'tracker.token', area, status: 'ok', reason: 'A tracker token is present, in the environment or the credentials file. Its value is not shown.' });
  }
  found.push({
    code: 'tracker.token_works',
    area,
    status: 'unknown',
    reason: 'Whether a token works is known only from the network, which the audit does not use.',
    recommendation: 'Run binn init, which reads the tracker once and says whether it was readable.',
  });
  return found;
}

/** Whether `CONTEXT.md`, an ADR directory and `docs/` exist. */
function docs(root: string): Finding[] {
  const area = 'docs';
  const check = (code: string, path: string, what: string, recommendation: string): Finding =>
    existsSync(join(root, path))
      ? { code, area, status: 'ok', reason: `${path} exists.` }
      : { code, area, status: 'gap', reason: `No ${path}: ${what}`, recommendation };
  return [
    check('docs.context', 'CONTEXT.md', 'the glossary of the domain an agent reads first.', 'Write CONTEXT.md; /grill-with-docs builds it as terms are settled.'),
    check('docs.adr', 'docs/adr', 'no architecture decisions are recorded.', 'Record durable trade-offs as ADRs under docs/adr.'),
    check('docs.docs', 'docs', 'no durable documentation directory.', 'Keep durable knowledge as Markdown under docs/.'),
    roadmap(root),
  ];
}

/** The roadmap Binnacle reads, `<knowledge.docs>/roadmap.md` (ADR-0025): docs/ when there is no usable manifest, as `binn init` would declare. */
function roadmap(root: string): Finding {
  const base = { code: 'docs.roadmap', area: 'docs' } as const;
  let docs: string | null = 'docs';
  try {
    docs = readManifest(root).manifest.knowledge.docs;
  } catch (error) {
    // No manifest: the one binn init proposes declares docs. One with problems declares nothing that can be trusted.
    if (!(error instanceof OperationError) || error.code !== 'manifest.missing') {
      return {
        ...base,
        status: 'unknown',
        reason: `${MANIFEST_RELATIVE} cannot be read as a manifest, so where its roadmap is, knowledge.docs, is not known.`,
        recommendation: `Fix ${MANIFEST_RELATIVE}; binn init names its problems.`,
      };
    }
  }
  if (docs === null) {
    return {
      ...base,
      status: 'gap',
      reason: `${MANIFEST_RELATIVE} declares no knowledge.docs, so Binnacle reads no roadmap.`,
      recommendation: `Declare knowledge.docs in ${MANIFEST_RELATIVE}, the directory whose roadmap.md is the roadmap.`,
    };
  }
  const path = posix.join(docs, 'roadmap.md');
  let text: string;
  try {
    text = readFileSync(join(root, path), 'utf8');
  } catch {
    return { ...base, status: 'gap', reason: `No roadmap at ${path}, so Binnacle shows no position and no Next action.`, recommendation: 'Run binn init, which proposes a roadmap skeleton in Binnacle\'s format and writes it only after you confirm.' };
  }
  const gaps = roadmapGaps(text);
  if (gaps.length === 0) return { ...base, status: 'ok', reason: `${path} is in Binnacle's format.` };
  return {
    ...base,
    status: 'gap',
    reason: `${path} is not in Binnacle's format. ${gaps.join(' ')}`,
    recommendation: `Bring ${path} into the format by hand, keeping its content; binn init never rewrites an existing roadmap.`,
  };
}

/** The Matt Pocock layout: its convention files and a spec directory, and the ticket-header convention. */
function mattPocockLayout(root: string): Finding[] {
  const area = 'matt-pocock-layout';
  const present = mattPocockFiles(root);
  const slugs = specSlugs(root);
  const missing = [...MATT_POCOCK_FILES.filter((path) => !present.includes(path)), ...(slugs.length === 0 ? ['docs/specs/<slug>/'] : [])];
  const found: Finding[] = [];
  if (missing.length === 0) {
    found.push({ code: 'layout.files', area, status: 'ok', reason: `The layout is in place: ${present.join(', ')}, and ${slugs.length} spec${slugs.length === 1 ? '' : 's'} under docs/specs/.` });
  } else if (present.length + slugs.length === 0) {
    found.push({
      code: 'layout.files',
      area,
      status: 'gap',
      reason: `No Matt Pocock layout: ${missing.join(', ')} are all missing.`,
      recommendation: 'Run /setup-matt-pocock-skills in your agent harness to set it up.',
    });
  } else {
    found.push({
      code: 'layout.files',
      area,
      status: 'gap',
      reason: `The Matt Pocock layout is partial. Present: ${[...present, ...slugs.map((slug) => `docs/specs/${slug}/`)].join(', ')}. Missing: ${missing.join(', ')}.`,
      recommendation: 'Add only the missing parts; /setup-matt-pocock-skills writes the convention files and /to-spec the spec directories.',
    });
  }
  const tracker = present.includes(ISSUE_TRACKER);
  found.push(
    hasTicketHeaderSection(root)
      ? { code: 'layout.ticket_header', area, status: 'ok', reason: `${ISSUE_TRACKER} has its ticket-header section.` }
      : {
          code: 'layout.ticket_header',
          area,
          status: 'gap',
          reason: `${ISSUE_TRACKER} has no ticket-header convention${tracker ? '' : ' (the file is missing)'}, which Binnacle reads a ticket's state and dependencies from (ADR-0024).`,
          recommendation: `${tracker ? 'R' : 'Once /setup-matt-pocock-skills has written the file, r'}un binn init, which offers to add the section.`,
        },
  );
  return found;
}

/** AGENTS.md and CLAUDE.md as the sets an agent reads. */
function instructions(root: string): Finding[] {
  const area = 'instructions';
  const sets = instructionSets(instructionFiles(root));
  if (sets.length === 0) {
    return [{ code: 'instructions.sets', area, status: 'gap', reason: 'No AGENTS.md or CLAUDE.md: a first agent starts without instructions.', recommendation: 'Write AGENTS.md; have CLAUDE.md hold @AGENTS.md if Claude Code needs its own file.' }];
  }
  const described = describeSets(sets);
  if (sets.length === 1) return [{ code: 'instructions.sets', area, status: 'ok', reason: `One instruction set: ${described}.` }];
  return [
    {
      code: 'instructions.sets',
      area,
      status: 'gap',
      reason: `Two instruction files that do not import each other: ${described}. An agent may read two truths.`,
      recommendation: 'Decide which is canonical, and have the other import it (a CLAUDE.md holding @AGENTS.md).',
    },
  ];
}
