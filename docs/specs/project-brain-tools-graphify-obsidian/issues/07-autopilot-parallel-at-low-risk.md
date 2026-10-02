# 07: Autopilot runs two Tasks together only at low risk

Status: DONE
Triage: ready-for-agent
Blocked by: 06
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** the baseline's rule — only low-risk Tasks run in parallel worktrees — followed by the one process that starts agents in parallel. `/binnacle:autopilot` reads the conflict risk from the snapshot (ticket 06) before starting a second ticket beside one in flight, and starts it only when the pair is low. Otherwise it runs them one after the other and says why in its progress. With the analysis not available, it keeps today's behaviour, and says the risk was not assessed.

- [x] The skill's instructions read the risk from the snapshot and start a second ticket only for a low pair.
- [x] A medium, high or unknown pair runs one after the other, and the skill says which pair and why.
- [x] With `impact` not available, autopilot keeps the parallel limit alone and says the risk was not assessed.
- [x] The packaging test still names every skill; ADR-0022's description in `docs/03-mcp-and-skills.md` mentions the rule.

## Comments

### For the next tickets

- The rule is a paragraph of step 5 of `.claude/skills/binnacle/skills/autopilot/SKILL.md`, with an end condition in step 9 and a *Conflict risk* entry in step 10's report. `apps/cli/test/pack.test.ts` holds the skill to it by its wording.
- No code changed: autopilot reads `tasks.parallel.impact` as ticket 06 left it. Ticket 08 shows the same pairs on the dashboard.

### Decisions taken here

- **In flight** is one of this run's agents, from the moment it is started, or a Task the snapshot lists in `inFlight`, unless this run stopped it. A stopped ticket keeps its branch, so the snapshot still lists it, but nobody works on it, as the parallel limit already reads it.
- **A pair the snapshot does not list counts as `unknown`.** `impact` covers every Task in flight and ready to start, so this is only a ticket read from the tickets' lines beyond the snapshot's, which then runs alone: safe, never guessed low.
- **The snapshot is read again before each second start**, since a branch's diff changes its modules.
- **A ticket that waits only on its risk with a Task this run did not start** (the owner's own work) would keep the run open forever. It goes to the report under *Waiting for the owner* and the run ends.
- **"Says why in its progress"** is one line in the session when it happens, once per pair, and the report's *Conflict risk* entry.
- **Without Binnacle** the risk is not assessed either, and the skill says Binnacle was not used.

### Review

`/code-review` ran against `main` on both axes, its two sub-agents in the foreground.

**Standards: no hard violation; six judgement calls.**

- Fixed: the skill said to repeat the pair and the unassessed risk in the report, but step 10 had no place for them. It gains *Conflict risk*.
- Fixed: "as before" was changelog language in a skill shipped to other projects; dropped.
- Fixed: without Binnacle there is no `impact` reason to quote; the skill says Binnacle was not used.
- Fixed: the test's comment named the ticket; it names the rule and ADR-0022.
- Kept: the wording test lives in `pack.test.ts`, beside the test that lists every skill, and matches phrases, as `init.test.ts` already reads a skill's text. A rephrasing has to update it, which is the point.

**Spec: every criterion met; one wrong behaviour and two smaller ones.**

- Fixed: the run could hang. A ticket autopilot stopped stays in the snapshot's `inFlight`, and a Task in flight that the run did not start never ends during it; either held a waiting ticket forever and step 9 never came. A stopped ticket no longer counts, and a ticket that waits only on a Task the run did not start goes to the owner and lets the run end.
- Fixed: a waiting pair was said again on every pass of step 5; now once.
- Kept: a ticket read beyond the snapshot's Tasks has no pair and runs alone as `unknown`. See *Decisions taken here*.
- Kept: the `CONTEXT.md` edit, since "nothing is blocked or reordered by it" stopped being true of autopilot.
