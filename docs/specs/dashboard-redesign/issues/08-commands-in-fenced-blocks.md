# 08: Commands in the chat in fenced blocks

Status: DONE
Triage: ready-for-agent
Blocked by: 06
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** every Binnacle skill gives each command it offers the human alone in a fenced block, which the Claude desktop app copies with one click (spec, *Commands in the skills*): a slash command in a plain fence, a shell command such as `binn daemon start` in a `bash` fence. `/binnacle:product`'s Next action and alternatives, `/binnacle:daily`, `/binnacle:checkpoint`, `/binnacle:task`, `/binnacle:status`, `/binnacle:answer`, `/binnacle:daemon`, `/binnacle:register`, `/binnacle:init`, `/binnacle:audit`, `/binnacle:autopilot`'s report and `/binnacle:help` among them. The roadmap's `Next action:` paragraph keeps its one command in backticks; the skill fences it when it shows it. Blocked by 06 because both edit autopilot's skill.

- [x] Every skill that offers the human a command says to give it alone in a fenced block, plain for a slash command, `bash` for a shell command.
- [x] No skill says to give a command inline in backticks.
- [x] The package build's tests over the skill texts pass.

## Comments

Each of the twelve skills that call or run something opens with one rule: give the human each command offered alone in a fenced block, a skill such as `/binnacle:daemon start` in a plain fence, a shell command such as `binn daemon start` in a `bash` fence. `/binnacle:autopilot` and `/binnacle:checkpoint` add that a drafted `Next action:` paragraph keeps its command in backticks, as the roadmap writes it. `/binnacle:help` fences each command its lists offer. The steps of `/binnacle:product`, `/binnacle:task` and `/binnacle:answer` that said "in backticks" or "as code" now say "alone in a fenced block". `docs/03-mcp-and-skills.md` states the rule beside the list of skills. No test was added: the spec checks the fences by review (*Testing Decisions*).

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, its sub-agents in the foreground.

**Standards.** To fix:

1. **"a slash command in a plain fence" named one harness's syntax** (every skill's rule, `docs/03-mcp-and-skills.md`), against ADR-0039's "a skill names another skill by its action": the `binnacle-<action>` copy is no slash command. **Fixed** in 4d55c34: "a skill such as `/binnacle:daemon start` in a plain fence", which the copy renames.

Kept:

2. The rule repeated in thirteen skills: each skill is read alone, as the repeated `binn call` fallback already is; the spec wants no test over the texts.
3. Steps of `product`, `task` and `answer` saying "alone in a fenced block" beside the rule: they replace their own "as code", at the step that ends with the command.
4. The draft exception only in `autopilot` and `checkpoint`: they alone draft the roadmap's `Next action:` paragraph.

**Spec.** No finding to fix. Kept:

5. `help`'s prose (the planning chain, the usual order of a day) keeps its commands inline: it names a sequence, and every one of its skills is fenced in the lists above.
6. Autopilot's push notification names `/binnacle:checkpoint` unfenced: a notification is not the chat, where a fence renders.
7. The rule in `docs/03-mcp-and-skills.md`, which the spec's documentation line does not name: documentation moves with the code.
