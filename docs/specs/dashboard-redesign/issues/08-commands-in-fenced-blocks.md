# 08: Commands in the chat in fenced blocks

Status: READY
Triage: ready-for-agent
Blocked by: 06
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** every Binnacle skill gives each command it offers the human alone in a fenced block, which the Claude desktop app copies with one click (spec, *Commands in the skills*): a slash command in a plain fence, a shell command such as `binn daemon start` in a `bash` fence. `/binnacle:product`'s Next action and alternatives, `/binnacle:daily`, `/binnacle:checkpoint`, `/binnacle:task`, `/binnacle:status`, `/binnacle:answer`, `/binnacle:daemon`, `/binnacle:register`, `/binnacle:init`, `/binnacle:audit`, `/binnacle:autopilot`'s report and `/binnacle:help` among them. The roadmap's `Next action:` paragraph keeps its one command in backticks; the skill fences it when it shows it. Blocked by 06 because both edit autopilot's skill.

- [ ] Every skill that offers the human a command says to give it alone in a fenced block, plain for a slash command, `bash` for a shell command.
- [ ] No skill says to give a command inline in backticks.
- [ ] The package build's tests over the skill texts pass.
