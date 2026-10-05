# 17: The dashboard shows the daemon's reasons in its own language

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** a defect found in epic 8's exit demonstration (2026-10-05). On the Russian dashboard, the conflict risk's reason ("Both touch nuxt.config.ts."), the "Not available in this version of Binnacle." of pending decisions and CI, and the attention items' messages are shown in English, as the daemon writes them. Show the reasons the dashboard knows by their code or kind in the interface's language, with the file and module names as they are; a reason it has no translation for stays as the daemon wrote it.

- [x] The risk's reason and the "not available" reasons are shown in Russian on the Russian dashboard and in English on the English one.
- [x] A test holds a translated reason and the fallback for an unknown one.

## Comments

Implemented on `feat/dashboard-reasons-in-the-ui-language`, in the dashboard alone; the daemon's answers are unchanged.

- A pair's conflict risk reason is written by the page from its kind, the pair's `risk`, with its `modules` and its Tasks' modules from `impact.tasks`, the names as they are (`pairReason` in `apps/dashboard/app/i18n/index.ts`). On the English page it is the daemon's own text.
- The daemon's reasons with no part of their own (`daemonReasons` in the dictionaries: "Not available in this version of Binnacle.", "The tracker cannot be read.", the graph's and the tracker's fixed reasons, the Review on a remote tracker, the fixed roadmap attention messages) are matched by their exact text and shown in the page's language (`daemonReason`). `DaemonReason.vue` shows every reason, attention message and not-available reason the pages showed as the daemon's, marked English only when it stays as the daemon wrote it.
- The rule moved from epic 6's spec, "the daemon's messages stay in English", to its new form in `docs/04-telemetry-dashboard.md`.

Answered without the owner, as the smallest the ticket allows:

- **Attention items with a part of their own stay English.** Most attention messages carry a path, an id or a tracker's words, and the snapshot gives them as text only, so the page cannot write them in its language; only the fixed ones are translated. Translating the rest needs the daemon to send each message's parts, a change to the snapshot left for a ticket that asks for it.
- **Known reasons are matched by their text, not by a code.** The not-available reasons carry no code (`{ available: false, reason }`), and a code would not tell the fixed `roadmap.missing` from its variant with a path. A test in `apps/dashboard/test/i18n.test.ts` takes the daemon's and core's own texts (`UNAVAILABLE`, `trackerUnavailable`, `parseRoadmap`), so a reworded one fails there rather than showing English.
- **A medium risk's reason in Russian names each Task's modules that neighbour the other's,** not which module neighbours which, as the daemon's does: the snapshot gives the pair's modules, not the neighbouring pairs (a `ponytail:` note in `pairReason`).

Checked by hand on a temporary daemon (`BINNACLE_PORT=0`, its own home under `.scratch/`, a fake `graphify` on its PATH) with a fixture project whose two READY tickets name `nuxt.config.ts`: the Russian Overview showed the pair as high with "Оба затрагивают nuxt.config.ts.", and the Russian Project page showed pending decisions and CI with "Недоступно в этой версии Binnacle."; the English page showed "Not available in this version of Binnacle.", marked English. The same check on the owner's daemon, after a merge and `pnpm dashboard:generate`:

```sh
binn dashboard   # Settings → Русский; the Project page's Pending decisions and CI read "Недоступно в этой версии Binnacle."
```

### Review

Reviewed against `main` on both axes, with the code review skill's sub-agents.

- **Standards**: no hard violation; all fifteen dashboard copies of the daemon's texts matched the daemon's at review. Fixed: no test tied the copies to the daemon's texts, now one does; the prop `written` is `translated`. Kept: the reasons are matched by text, for the reasons above; `pairReason` spells the two shapes it reads from `Impact` rather than importing them, since importing `composables/projects.ts` pulls Nuxt into the root typecheck; the page's pair reasons repeat the daemon's wording in Russian, which is what a translation is. Left: a line in ADR-0033, since `docs/04-telemetry-dashboard.md` holds the rule.
- **Spec**: every criterion holds, nothing out of scope. Fixed: the English page wrote its own medium reason, which dropped the daemon's neighbouring pairs, and capitalised only the first part of an unknown reason; English now shows the daemon's own pair reason. Kept: the Russian medium reason, recorded above; text matching rather than codes, recorded above, with its guard test. Left: epic 6's spec, which records the earlier decision as it was taken.
