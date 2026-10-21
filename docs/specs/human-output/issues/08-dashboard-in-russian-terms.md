# 08: The dashboard in Russian terms, without codes

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/human-output/spec.md`

**What to build:** the dashboard's Russian is one language (spec, *The dashboard*, *Marks of calculation*). Its Russian dictionary translates every term epic 6 kept English, with the spec's words. Attention items and daemon reasons are worded from core's wording and `params` (ticket 02), and the text-matched `daemonReasons` move there; a message with no wording keeps its English mark. No code is shown, *Full* included. A calculated value is marked by one word, "(оценка)" or "(estimate)", a reading from runs by "(по активности)" or "(from activity)", an unknown is "нет данных" or "no data". `docs/04-telemetry-dashboard.md`'s language paragraph takes ADR-0045's rule in place of epic 6's.

- [ ] Through the dashboard's i18n tests: the Russian dictionary holds none of the terms epic 6 kept English; an attention item is worded from its code and `params`; the marks are one word.
- [ ] No code in the rendered attention items or reasons.
- [ ] Checked in a browser, in Russian and in English.
