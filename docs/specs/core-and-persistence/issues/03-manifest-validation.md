# 03: Full manifest validation and diagnostics

Status: DONE
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/core-and-persistence/spec.md`

**What to build:** a broken `.binnacle/project.yaml` tells its owner everything that is wrong with it in a single run, in terms of the file they wrote — not in terms of Binnacle's internals. A manifest written by a newer Binnacle degrades instead of failing.

- [x] Every problem in a manifest is reported in one response, so fixing it is one edit rather than one edit per run.
- [x] Each problem names the exact field path and what was expected there.
- [x] Unknown keys are reported as warnings and do not fail registration.
- [x] Validation never throws on invalid input; it returns problems.
- [x] Validation is a pure function in the core package with no runtime dependencies. Reading the file and parsing YAML happen outside it. Ticket 02 staged this in the daemon to keep its own scope small; this ticket is what moves it, and `packages/core` does not exist until it does.
- [x] No secret is read from the manifest or written to it; tracker credentials never appear there (ADR-0013).
- [x] A manifest that changed since it was last projected is re-read and the change recorded as an event.

## Comments

Implemented on `feat/manifest-validation`. 67 tests pass, `tsc --noEmit` clean.

- **`packages/core` is born, and it is pure.** `validateManifest(document: unknown)` takes an already-parsed document and returns problems, warnings and — only when there are no problems — a typed manifest. It imports nothing: no `node:` modules, no dependencies, and a test asserts both rather than trusting the convention.
- **Reading and parsing stay in the daemon.** The file side finds `.binnacle/project.yaml`, reads it and parses the YAML; everything after that is core's. That is also what keeps the `yaml` dependency out of core.
- **An unsupported version is its own answer, not one problem among many.** Every other field was read against rules that may simply not apply to that version, so reporting them together would be noise. `manifest.unsupported_version` still names the supported version, as ticket 02 requires.
- **Defaults mirror the template**, with one deliberate choice: an absent `tracker.provider` means `local`, not `github`. Assuming a remote tracker nobody declared is the worse guess.
- **Capability names are open**, only their values are checked. A tool Binnacle has never heard of is a fact about the user's machine, not a mistake in their file.
- **Warnings reach the user.** `project.register` returns them and `binn project register` prints them to stderr — registration succeeded, so stdout stays the result.
- **`project.manifest_changed` comes from one place.** `reproject()` derives the row, compares it with what was projected before, writes it and records the change. A first projection is not a change and an identical re-read is not one either, so the history stays worth reading.

Two things a reviewer should know:

- **`store.project(path)` is back.** Ticket 02's review deleted it as having no callers; `reproject()` is the caller it was missing. That was the right call at the time and this is the right call now, but it is worth seeing the round trip.
- **A ticket 02 test changed.** "Survives the projection being re-derived on the next start" changed the manifest between runs and asserted the history held only `project.registered`. That manifest change now correctly records `project.manifest_changed`, so the expectation was stale rather than the behaviour wrong. The test still proves what it was written to prove.

### Review

Reviewed on both axes. Both found the same defect independently, which is usually a sign it matters.

- **A document that is not a mapping named the wrong field.** An empty file, a list, a bare number — core recorded `(document): expected a YAML mapping`, and then the version branch fired first and answered "declares version null; this Binnacle supports version 1", naming a field the user never wrote and hiding the real one. It was also a regression of a check ticket 02 had. `versionSupported` is now `boolean | null`, where null means the question does not arise, and the test asserts the reported path rather than only the code prefix — which is why the old test let it through.
- **`project.manifest_changed` could only see two fields.** This ticket started validating `tracker`, `knowledge`, `workflow`, `capabilities`, `automation` and `telemetry`, but the comparison read the projection row, which carries the id and the name. A change to any other section was re-read and silently dropped. The projection now stores a digest of the whole validated manifest, and the comparison is name-independent, so a column added later is compared too rather than quietly stopping the event.
- **Defaults invented facts.** An absent `tracker.provider` became `local`, an absent `telemetry.privacy` became `metadata`. Ticket 04 raises a diagnostic when the declared tracker disagrees with the Git remote — against a provider nobody declared, that diagnostic is noise. A field the user did not write now comes back null and defaults belong at the point of use. Defaulting a privacy control was the sharpest case of the three.
- **One path echoed a manifest value into the tier that is never dropped.** The unsupported-version message embedded the declared value, `deriveProject` stored that message as the unavailability reason, and `reproject` copied the reason into the event payload. The payload now carries facts — id, name, available — and the message names no value. A test writes a secret into a manifest, then breaks the manifest, and asserts the whole event history is clean.
- Dropped the `@binnacle/core` dependency the CLI had taken for one type: `ErrorDetail` from `@binnacle/daemon` is the same shape and was already imported beside it. Trimmed five core exports nothing consumes. Renamed `known` (it records the *unknown*), and split `mapping`/`asMapping` into `sectionOf` and `requireMapping`, which say what they differ on.

Two judgement calls kept, both recorded rather than silently held:

- **The purity test moved into `packages/core/test/`.** Reaching from the daemon's tests across a package boundary to regex another package's sources was the wrong place for it. A package checks its own boundary.
- **`packages/core` now has tests of its own, which is a second seam.** The spec fixes one seam at the daemon's HTTP API, and that rule holds for the daemon. This is a different thing: the public function of a separate package, whose contract three later epics consume and which the daemon does not expose until ticket 04 puts manifest facts on `project.status`. The alternative was shipping the no-defaults rule untested until then. Confined to the public function; nothing reaches inside it.

Unknown *capability* names stay accepted without a warning, and there is now a test pinning that rather than only a paragraph. A tool Binnacle has never heard of is a fact about the user's machine.

Merged to `main` in `3ffa49f`, review included.
