# 17: The dashboard shows the daemon's reasons in its own language

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** a defect found in epic 8's exit demonstration (2026-10-05). On the Russian dashboard, the conflict risk's reason ("Both touch nuxt.config.ts."), the "Not available in this version of Binnacle." of pending decisions and CI, and the attention items' messages are shown in English, as the daemon writes them. Show the reasons the dashboard knows by their code or kind in the interface's language, with the file and module names as they are; a reason it has no translation for stays as the daemon wrote it.

- [ ] The risk's reason and the "not available" reasons are shown in Russian on the Russian dashboard and in English on the English one.
- [ ] A test holds a translated reason and the fallback for an unknown one.

## Comments
