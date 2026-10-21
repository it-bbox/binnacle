import { existsSync } from 'node:fs';
import { join, posix } from 'node:path';
import { hasUncommittedChanges, isGitUnavailable } from '@binnacle/adapters';
import type { Diagnostic, ProjectManifest } from '@binnacle/core';
import { invalidRequest, OperationError } from './errors.ts';
import { resolveGitTimeout } from './home.ts';

/**
 * The checkpoint (`checkpoint.prepare`, `checkpoint.record`). Binnacle computes the delta
 * and the promotion targets, and records that a checkpoint happened; the calling session
 * writes and commits the promotions itself (ADR-0020).
 *
 * The kinds of durable knowledge a session promotes before it closes, from the knowledge
 * promotion rule (`docs/02-project-brain.md`).
 */
export const PROMOTION_TYPES = ['vocabulary', 'trade_off', 'new_work', 'product_rule', 'position'] as const;
export type PromotionType = (typeof PROMOTION_TYPES)[number];

/** Relative to the project directory; null when this project declares no place for it. */
export type PromotionTarget = { type: PromotionType; path: string | null };

/**
 * Where each kind lands in this project, from the manifest's `knowledge` section and its
 * tracker. New work has a path only on the local Markdown tracker, where tickets are files;
 * the roadmap is `<knowledge.docs>/roadmap.md` whatever the tracker (ADR-0025).
 */
export function promotionTargets(manifest: ProjectManifest | null): PromotionTarget[] {
  const local = manifest?.tracker.provider === 'local';
  const docs = manifest?.knowledge.docs ?? null;
  const paths: Record<PromotionType, string | null> = {
    vocabulary: manifest?.knowledge.context ?? null,
    trade_off: manifest?.knowledge.adr ?? null,
    new_work: local ? manifest.tracker.local.issues : null,
    product_rule: manifest?.knowledge.specs ?? null,
    position: docs === null ? null : posix.join(docs, 'roadmap.md'),
  };
  return PROMOTION_TYPES.map((type) => ({ type, path: paths[type] }));
}

/** What the session reports it promoted: a file or directory, relative to the project directory. */
export type Promoted = { type: PromotionType; path: string };

/** `promoted` from a `checkpoint.record` body: an array, possibly empty, of `{ type, path }`. */
export function promotedItems(body: unknown): Promoted[] {
  const promoted = (body as { promoted?: unknown } | null)?.promoted;
  if (!Array.isArray(promoted)) throw invalidRequest('promoted', '"promoted" must be an array of { type, path }, empty when nothing was promoted.', 'expected an array', 'expected.array');
  return promoted.map((item: unknown, index) => {
    const { type, path } = (item ?? {}) as { type?: unknown; path?: unknown };
    if (!PROMOTION_TYPES.includes(type as PromotionType)) {
      throw invalidRequest(`promoted.${index}.type`, `"promoted[${index}].type" must be one of ${PROMOTION_TYPES.join(', ')}.`, `expected one of ${PROMOTION_TYPES.join(', ')}`, 'expected.one_of', {
        allowed: PROMOTION_TYPES.join(', '),
      });
    }
    // Relative and inside the project: it is looked up in the caller's checkout, and nowhere else.
    if (typeof path !== 'string' || path.trim() === '' || posix.isAbsolute(path) || posix.normalize(path).split('/')[0] === '..') {
      throw invalidRequest(`promoted.${index}.path`, `"promoted[${index}].path" must be a path relative to the project directory.`, 'expected a relative path inside the project', 'expected.relative_path');
    }
    return { type: type as PromotionType, path };
  });
}

/**
 * One diagnostic per promoted path that is not committed at HEAD as it stands: one with
 * uncommitted changes, which the checkpoint's head does not hold and the next delta would
 * show again as new work; and one that names nothing in the checkout, which is a typo, not
 * a promotion. `cwd` is the project directory in the caller's checkout.
 */
export async function promotionDiagnostics(cwd: string, promoted: Promoted[], head: string): Promise<Diagnostic[]> {
  const timeout = resolveGitTimeout();
  let dirty: boolean[];
  try {
    dirty = await Promise.all(promoted.map(({ path }) => hasUncommittedChanges(cwd, path, timeout)));
  } catch (error) {
    // Nothing is recorded: a checkpoint whose check failed would look like a clean one.
    if (isGitUnavailable(error)) throw new OperationError(error.code, error.reason, 503, undefined, error.params);
    throw error;
  }
  const diagnostics: Diagnostic[] = [];
  promoted.forEach(({ path }, index) => {
    if (dirty[index]) {
      diagnostics.push({
        code: 'checkpoint.uncommitted',
        message: `${path} has uncommitted changes, so it is not in the recorded head ${head} and will show again in the next delta. Commit it and record the checkpoint again.`,
        params: { path, head },
      });
      // A clean path missing from the working tree is missing from HEAD too, or Git would report its deletion.
    } else if (!existsSync(join(cwd, path))) {
      diagnostics.push({ code: 'checkpoint.path_missing', message: `${path} names nothing in this checkout, so nothing was promoted there.`, params: { path } });
    }
  });
  return diagnostics;
}
