# 15: /binnacle:product shows the graph's freshness and the conflict risk

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** a defect found in epic 8's exit demonstration (2026-10-05). The snapshot carries `graph` (built from which commit, `behind`, the last run) and `tasks.parallel.impact` (each pair's risk and reason), and the dashboard shows both, but `/binnacle:product`'s steps never mention them, so a Product session saw the risk only by chance and the graph's freshness not at all. Add both to the skill's presentation: the graph in one line (current or behind, built from which commit, the last run's outcome), or its reason when `available: false`; each pair's risk with its reason beside the Tasks ready to start, marked as Binnacle's calculation, or why it was not assessed.

- [x] `/binnacle:product` presents the graph and the conflict risk as above.
- [x] A test in `apps/cli/test/pack.test.ts` holds the wording.

## Comments

- **Where the two lines sit.** The graph is its own bullet after *Recent decisions*; the conflict risk is a bullet right after *Tasks in flight* and *ready to start*. Each pair also names the `modules` its risk rests on, as `/binnacle:autopilot` does.
- **An unavailable graph or risk** gives its reason in place, and *Not available* now names every *other* section, so that neither is said twice.

### Review

Code review against `main`, both axes, with its sub-agents.

- **Fixed.** A graph built outside the daemon, such as `binn init`'s first build, has no recorded build: `builtFrom` and `lastRun` are `null` and `behind` reads `true`. The skill now says "no build recorded" or "no run recorded" and never calls such a graph behind; the test holds it, as it holds the `null` `behind`.
- **Fixed.** An unavailable graph or risk was named both in place and under *Not available*; now only in place.
- **Fixed.** An empty `pairs` had no wording; it is "no pair to assess".
- **Fixed.** Each pair's `modules` were left out, unlike autopilot's wording; they are named now.
- **Left.** When the graph is not available but an earlier build is still recorded, the skill gives the reason alone, as the ticket asks.
- **Left.** `pairs` also holds pairs of two Tasks in flight; the line still sits beside the Tasks ready to start, where the ticket puts it.
- **Kept.** The test matches the skill's sentences word for word, as every other skill test in `pack.test.ts` does.

### Hand check (the owner's)

After the merge, once autopilot or `claude plugin update binnacle@binnacle` has refreshed the plugin, open a new session in this repository and run `/binnacle:product`:

1. The answer has a **Graph** line: current or behind, built from which commit and when, and the last run's outcome and time; or the graph's reason when it is not available.
2. Beside the Tasks ready to start, a **Conflict risk** line gives each pair's risk, reason and modules, called Binnacle's calculation; or "no pair to assess"; or that the risk was not assessed, with its reason.
3. Neither is listed again under **Not available**.
