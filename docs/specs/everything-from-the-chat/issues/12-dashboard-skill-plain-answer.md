# 12: /binnacle:dashboard answers plainly

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** a defect found in epic 9's exit demonstration (2026-10-05). After `binn dashboard` opened the browser, the skill's answer said that the token in the output had been masked before it reached the chat, and asked the owner to copy "the full address with `#token=`" from a terminal. Neither is true since ticket 06: `binn dashboard` prints no token at all, and the browser opens already authorised. The answer is: the dashboard opened in the browser, at the printed address; if no browser appeared, run `binn dashboard --print` at a terminal and open what it prints there, without pasting it into the chat.

- [ ] `/binnacle:dashboard`'s text leaves no room for a masked token or for copying an address with a token from `binn dashboard`'s output.
- [ ] A test in `apps/cli/test/pack.test.ts` holds the wording.

## Comments
