# 12: /binnacle:dashboard answers plainly

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** a defect found in epic 9's exit demonstration (2026-10-05). After `binn dashboard` opened the browser, the skill's answer said that the token in the output had been masked before it reached the chat, and asked the owner to copy "the full address with `#token=`" from a terminal. Neither is true since ticket 06: `binn dashboard` prints no token at all, and the browser opens already authorised. The answer is: the dashboard opened in the browser, at the printed address; if no browser appeared, run `binn dashboard --print` at a terminal and open what it prints there, without pasting it into the chat.

- [x] `/binnacle:dashboard`'s text leaves no room for a masked token or for copying an address with a token from `binn dashboard`'s output.
- [x] A test in `apps/cli/test/pack.test.ts` holds the wording.

## Comments

- **What misled the answer.** The skill described stdout as "the address without its token" and `--print` as giving "the address with its token", so the answer read the printed address as one with its token cut out. The skill now says `binn dashboard` prints the address alone, which carries no token and from which nothing was masked, and it no longer uses either phrase. A test forbids both.
- **The CLI's own line is unchanged.** When no opener can start, `binn dashboard` prints on stderr that `binn dashboard --print` at a terminal gives "the address with its token". That is true, and the skill tells the human to open what `--print` prints there and not to paste it into the chat. Rewording the CLI message is outside this ticket, which is about the skill's text.
- **docs/03's `/dashboard` line** now gives the same answer, so that it does not describe the old one.

### Review

Code review against `main`, both axes.

- **Fixed.** In the branch where no browser could be opened, the rewrite no longer showed the printed address, which spec story 33 asks for "even when no browser opened". Step 2 now shows it whether or not a browser opened, and the test holds that.
- **Fixed.** With no browser, the answer said "no browser opened" and then "if no browser appeared". That branch now says to run `binn dashboard --print` at a terminal outright.
- **Fixed.** The rule against copying an address from `binn dashboard`'s output could be read as covering `--print` too. It now names step 1's output.
- **Kept.** The answer says the dashboard opened in the browser, as the ticket words it, though `binn` only starts the opener. The same sentence gives the `--print` fallback if no browser appeared.
- **Kept.** "Open what it prints there" is the ticket's wording; "there" is the terminal the human runs it at.
- **Kept.** The skill says both that nothing in the address was masked and that the answer must never say a token was masked. The first is a fact about the output, the second a rule for the answer.
- **Left.** The CLI's stderr line, quoted in the no-browser branch, still says "the address with its token", as above.

### Optional hand check

In a Claude Code session on this repository, with the daemon running, type `/binnacle:dashboard`. The dashboard opens in the browser. The answer shows an address with no `#token=`, says the dashboard opened there, and says that if no browser appeared, `binn dashboard --print` at a terminal gives what to open there, not to be pasted into the chat. It speaks of no masked or hidden token.
