# What Binnacle's own work cost

_Русская версия: [write-up.ru.md](write-up.ru.md)._

Binnacle was built with the coding agents it is built for, and it recorded the token usage of the sessions that did the work. This write-up reads those records back: what the work cost and where the tokens went.

It is all summary aggregates. No ticket, task or session is named, and every figure is Binnacle's own reading of its usage data on **31 October 2026**.

## How to read the numbers

- **A record is one call, counted once.** When a harness's session file and its OpenTelemetry export both report the same call, Binnacle stores one record for it.
- **Token kinds are never added together.** Cached input is context the provider re-read from its cache; reasoning is the part of the output the model thought in. They are shown side by side, as Binnacle shows them.
- **A partial counter is a floor.** Some harnesses report only some token kinds. Binnacle says the missing ones as no data, never as zero, so a total over a partial counter is a lower bound.
- **Calculated readings are marked.** Every sum, mean and share below is Binnacle's calculation over the stored records; the token counts themselves are what each harness reported.

## The whole picture

| Records | Input | Cached input | Cache creation | Output | Reasoning |
| --- | --- | --- | --- | --- | --- |
| 28,470 | 2,845,108 | 4,757,627,781 | 114,658,043 | 19,990,342 | 6,402,652 |

The token counters are partial; the record count is exact. Binnacle's import window for this project starts on 3 August 2026, and the records it found run from the week of 14 September.

## Where the tokens went, by role

Binnacle attributes each run to the role it played: Product work on the roadmap and specs, implementation on a ticket's branch, review by a subagent, rework after the review, and unknown for work it cannot place. The role is a calculated reading, taken from the run's branch and commits.

| Role | Records | Input | Cached input | Cache creation | Output | Reasoning |
| --- | --- | --- | --- | --- | --- | --- |
| Product | 6,915 | 2,063,155 | 1,524,530,056 | 33,627,232 | 4,609,092 | 1,271,800 |
| Implementation | 9,688 | 430,610 | 1,462,589,565 | 21,677,055 | 6,631,494 | 2,104,655 |
| Review | 3,022 | 38,170 | 259,022,754 | 23,442,893 | 2,080,344 | 1,025,030 |
| Rework | 3,223 | 98,344 | 667,608,269 | 7,275,988 | 2,170,181 | 442,556 |
| Unknown | 5,622 | 214,829 | 843,877,137 | 28,634,875 | 4,499,231 | 1,558,611 |

## By model

Which models carried the work, over the same records:

| Model | Records | Input | Cached input | Cache creation | Output | Reasoning |
| --- | --- | --- | --- | --- | --- | --- |
| claude-opus-5-5 | 27,218 | 1,000,798 | 4,564,382,657 | 109,704,537 | 18,797,125 | 6,053,158 |
| claude-sonnet-5 | 400 | 961,913 | 84,692,096 | 0 | 238,843 | 0 |
| claude-sonnet-5-5 | 378 | 782 | 46,263,823 | 1,908,247 | 291,865 | 47,384 |
| claude-opus-5 | 353 | 706 | 58,792,507 | 2,557,552 | 569,221 | 292,669 |
| claude-haiku-5-5 | 51 | 614,413 | 1,466,746 | 487,707 | 52,754 | 5,908 |
| GLM-5.3 | 35 | 99,471 | 1,261,504 | 0 | 29,101 | 0 |
| gpt-6.1-sol | 23 | 125,581 | 637,696 | 0 | 8,955 | 3,116 |
| Other models | 12 | 41,444 | 130,752 | 0 | 2,478 | 417 |

*Other models* gathers four calls whose harness named no model and the models used for a handful of calls each.

## What a completed Task cost

- **200 completed Tasks** have attributed runs; **50 more** were completed without a run Binnacle could attribute to them.
- **Mean per completed Task, calculated:** 79.6 records, 2,587 input, 11,934,411 cached input, 261,980 cache creation, 54,354 output and 17,861 reasoning tokens.
- **Mean runs per Task, calculated:** 4.2, of which 3.3 were subagent runs.
- **Rework share, calculated:** 30.5% — rework tokens over implementation plus rework tokens, averaged over completed Tasks.
- **First-pass acceptance, calculated:** 8.0% — the share of reviewed completed Tasks that needed no rework at all.

## Weekly trends

| Week from | Records | Input | Cached input | Cache creation | Output | Reasoning |
| --- | --- | --- | --- | --- | --- | --- |
| 14 September 2026 | 311 | 622 | 48,306,944 | 1,758,171 | 490,959 | 256,911 |
| 21 September 2026 | 7,346 | 32,986 | 1,163,971,130 | 31,908,464 | 5,960,917 | 2,346,865 |
| 28 September 2026 | 2,026 | 4,190 | 296,558,259 | 8,847,087 | 1,354,798 | 279,870 |
| 5 October 2026 | 7,064 | 529,020 | 1,148,221,791 | 28,813,834 | 4,356,491 | 1,176,334 |
| 12 October 2026 | 5,642 | 516,404 | 1,022,222,662 | 19,685,438 | 3,882,184 | 1,230,608 |
| 19 October 2026 | 2,825 | 139,701 | 494,755,307 | 11,188,892 | 1,867,636 | 568,774 |
| 26 October 2026 | 3,256 | 1,622,185 | 583,591,688 | 12,456,157 | 2,077,357 | 543,290 |

The last week is the week in progress on the date of writing. The weekly totals are Binnacle's grouping; a few of their counters are partial, as some harnesses report only some token kinds.

## The method

Everything here is read from Binnacle's own usage data with `usage_get` on 31 October 2026, and matches it on that date. The figures are one reading, taken at one moment; Binnacle keeps recording as it works, so a later call sees a few more records. Binnacle stores tokens, never cost or price. A calculated reading is marked so, and a reporting gap is said as no data, never as zero.
