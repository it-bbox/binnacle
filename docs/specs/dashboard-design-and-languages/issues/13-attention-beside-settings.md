# 13: Attention sits beside Projects and Settings

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** found by the owner on 2026-10-10: opened from a project, the Attention page showed every project's items. That is the page's design ("Attention · All projects", spec, *The shell and pages*), but its link sat in the sidebar's first group, beside Overview, Project and Usage, which show the selected project alone, so it read as that project's page. The link moves to the sidebar's second group, the general one under the divider, with Projects and Settings. The page itself does not change.

- [ ] The sidebar's first group holds Overview, Project and Usage; its second, under the divider, holds Projects, Attention and Settings, in that order.
- [ ] Attention's count badge counts every project's attention items, as the page lists them, and still shows only when there is at least one.
- [ ] The Attention page is unchanged, and its link keeps the selected project in the address, as every link in the sidebar does.
- [ ] The labels read right in English and Russian.
- [ ] The spec's *The shell and pages*, the design brief's sidebar and `docs/04-telemetry-dashboard.md` describe the new groups.

## Comments

- **Decided by the owner in chat, 2026-10-10:** move the link, not filter the page to the selected project. The ticket was therefore written on its implementation branch, not by a Product session.

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violation.** Findings, all judgement calls:

1. **The sidebar reads all projects by `inject`**, while the shell's components take theirs as props from `app.vue`, as the rail takes `views`, and `inject` is the pages'. **To fix**: the sidebar takes `views` as a prop, as the rail does.
2. **The badge's sum is computed in the page**, where the spec's user story 40 puts logic in the daemon. **Kept**: a count of what the shell already holds, as the Projects and Attention pages count theirs.
3. **Duplicated Code**: a project's attention count, `view.snapshot?.attention.length ?? 0`, is now written in the rail and the sidebar. **To fix**: one `attentionCount` beside `count` and `initials` in `composables/projects.ts`, used by both.
4. **Mysterious Name**: `attention` is a number in the sidebar and a function in the rail. **To fix**: closed by 3's name.
5. **The ticket is not yet done**: no Review, criteria unticked. **Kept**: the order of commits the workflow sets, which the commits after this one complete.

**Spec: every criterion holds; nothing beyond the ticket.** Findings:

6. **The ticket's Comments say neither where the change lives nor how it was checked**, as tickets 07 to 10 do. **To fix**.
7. **The spec's user story 28 still lists Attention in the first group.** **Kept**: the stories say what was asked when the epic was specified, and *Further Notes* records what changed since, as ticket 10 left the same story without Settings.
8. **The mockup, `design/Binnacle Dashboard.dc.html`, keeps Attention in the first group**, with a count of the selected project's items. **Kept**: the design brief records the departure, as it does for the language switch.
9. **Ticket 01 lists the old menu.** **Kept**: a done ticket says what it built.
