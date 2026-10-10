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
