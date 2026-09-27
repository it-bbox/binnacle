# 10: A Settings page, with the language and the settings to read

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** asked by the owner in the exit demonstration (ticket 06, *Comments*): a Settings page. More languages will come, so the language choice leaves the main screen for this page. The page also shows the project's and the daemon's settings, read-only, each with where to change it, since the dashboard never writes (ADR-0020). Decided in the spec, under *Further Notes*, *Found in the exit demonstration*.

- [ ] The sidebar gains Settings, and loses the language switch. The freshness line stays at its foot.
- [ ] Settings shows the language as a choice among the dictionaries the dashboard has, English and Russian today. Adding a language is adding a dictionary: the choice lists every dictionary without further change. The choice is kept in local storage and still starts from the browser's language, as ticket 01 made it.
- [ ] Settings shows the selected project's settings from `project.status`'s manifest, read-only: tracker, workflow, capabilities, automation (with `max_parallel_development_tasks`) and telemetry. It names `.binnacle/project.yaml` as the file to edit, and says the daemon reads a change on its next refresh.
- [ ] A manifest with diagnostics shows them with their codes. A project without a manifest says so, with `binn init` to copy.
- [ ] Settings shows the daemon's version and address, with `binn daemon stop` and `binn daemon start` to copy.
- [ ] Nothing on the page writes anything: the only actions are the language choice, kept in the browser, and copying commands.
- [ ] The page reads well in English and Russian, in both themes and at 1024 px.
- [ ] `docs/04-telemetry-dashboard.md` describes the Settings page, and the design brief's shell no longer puts the language switch in the sidebar.
