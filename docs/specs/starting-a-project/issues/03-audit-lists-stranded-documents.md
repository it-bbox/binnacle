# 03: The audit lists stranded documents

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/starting-a-project/spec.md`

**What to build:** `binn audit` names the documents a project keeps outside Binnacle's places, so that an adoption forgets none (spec, *Stranded documents in the audit*). A new check, `docs.stranded`, in the `docs` area, lists from `git ls-files` the Markdown and text files outside Binnacle's places whose name or directory says a plan, a spec, a decision, a TODO, notes, a backlog, a design, an RFC, a PRD or a roadmap, and an ADR directory other than `<knowledge.docs>/adr/`. Binnacle's places are the root's README, licence, changelog, contributing and security files, the instruction files, `CONTEXT.md`, and under `<knowledge.docs>` its `roadmap.md`, `vision.md`, `product-inbox.md`, `specs/`, `adr/` and `agents/`. It is `ok` with none, otherwise `unknown`, each path in the reason and the recommendation to run `/binnacle:roadmap`. It writes nothing. `CONTEXT.md` defines *Stranded document*.

- [x] Through `binn audit --json` on a fixture with a `TODO.md`, a `plans/` directory, a spec outside `docs/specs/` and a `doc/adr/`: each is listed, status `unknown`.
- [x] A fixture with only Binnacle's places reports `ok`; untracked and ignored files are never listed.
- [x] Two runs give the same answer, and the audit writes nothing.
- [x] `CONTEXT.md` defines *Stranded document*.

## Comments

- Where the spec is silent: a directory whose name matches is listed once, as `plans/`, not file by file; the "instruction files" include anything in a dot-directory (`.claude/`, `.github/`, `.cursor/`), where harnesses keep settings and skills; Markdown and text are `.md`, `.markdown`, `.mdx` and `.txt`; and when the manifest declares no `knowledge.docs` or cannot be read, the places under it are taken at `docs/`, as `binn init` would declare, while `docs.roadmap` beside it says why.
- On this repository the check names `docs/05-mvp-plan.md`, as the spec expects.

### Review

Against `main`, on the standards and the spec; the ticket names no role beyond the Developer and the Reviewer.

1. **Root files matched any suffix**: `([-_.][^/]*)?` after README, licence, changelog, contributing and security made `README-roadmap.md` a place. **Fixed** in `apps/cli/src/audit-files.ts`: an extension only, `(\.[^/]*)?`, so `README.ru.md` and `LICENSE.txt` stay places; the test lists `README-roadmap.md`.
2. **A dot-file was taken for a dot-directory**: `(^|\/)\.` hid `src/.notes.md`. **Fixed**: `(^|\/)\.[^/]*\/`, directories only; the test lists `src/.notes.md`.
3. **The module header of `audit-files.ts`** still said only `git check-ignore` runs. **Fixed**: it names `git ls-files` and the stranded documents.
4. **`OWN` hid what it holds.** **Fixed**: renamed `PLACES`, the term `CONTEXT.md` uses.
5. `docs` as the fallback is written twice, in `knowledgeDocs` and at the `stranded` call. **Kept**: they are two cases, no manifest and an undeclared or unreadable one, and `docs.roadmap` needs them apart.
6. `knowledgeDocs` returns `string | null | undefined`. **Kept**: one caller, and its comment names the three states.
7. Any tracked dot-directory is a place, so a `.plans/` would be hidden. **Kept**: a dot-directory is a tool's, and a list of harness directories would need upkeep.
8. CamelCase names (`ProductRoadmap.md`), `.rst`, `.adoc` and extensionless `TODO` are not listed. **Left**: the spec says Markdown and text, and a name is matched between `-`, `_`, `.` and spaces; widen when an adoption misses one.
9. `CONTEXT.md` lists the places in full. **Kept**: the term means nothing without them, and the spec defines them so.
10. A tracked file that `.gitignore` also matches is listed. **Kept**: Git does not ignore a tracked file, and the list is `git ls-files`.
