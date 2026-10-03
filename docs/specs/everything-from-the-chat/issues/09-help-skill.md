# 09: /binnacle:help

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** `/binnacle:help`, a plain-language guide to working with Binnacle, in the language the user writes in (stories 51 to 53). The skill's text is the guide: what Binnacle is in two sentences, each skill of the plugin with one plain line on when to use it, grouped as setting up, a day's work and planning, and the usual order of a day (`/binnacle:product`, the work, `/binnacle:checkpoint`). It calls no tool, runs no command and needs no daemon. See the spec's *Implementation Decisions*, the `/binnacle:help` entry.

- [ ] The skill exists in the `binnacle` plugin with `disable-model-invocation: true`, and says to answer in the language the user writes in.
- [ ] A test in `apps/cli/test/pack.test.ts` checks that it names every skill directory of the plugin, so a skill added later fails the test until the guide names it.
- [ ] It calls no tool and runs no command.
- [ ] The plugin's description, the marketplace listing and `docs/03-mcp-and-skills.md` name `/binnacle:help`.

## Comments
