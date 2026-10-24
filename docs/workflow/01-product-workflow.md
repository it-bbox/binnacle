# Product Steward Workflow

## Product is a role, not a chat

A Product session is disposable. Project memory lives outside the conversation.

## Start of day / fresh session

```text
new chat
  ↓
/binnacle:product
  ↓
project.detect
  ↓
product snapshot
  ↓
/binnacle:daily
```

The snapshot should be compact and include only current/recently relevant state:

- current milestone and roadmap position;
- active/review/blocked tasks;
- overnight/recent AgentRuns;
- questions needing Product decision;
- recent durable decisions;
- Git/PR/CI summary;
- usage/context warnings;
- recommended attention items.

Deeper context is loaded lazily from tracker/docs/Graphify/source.

## Daily

Daily is delta-oriented. It should answer:

- what changed since previous daily/checkpoint;
- what completed;
- what is active;
- what is blocked;
- what requires human/Product decision;
- what can start next;
- notable usage/waste signals.

It must not repeat the full project description every day.

## During development

Product does not constantly observe a developer chat. It reacts to visible events:

- `QUESTION_CREATED`;
- `BLOCKED`;
- `TASK_READY_FOR_REVIEW`;
- `BUDGET_WARNING`;
- `TEST_FAILURE` where Product intervention is required.

This reduces duplicate context consumption.

## Product decisions

When a developer asks something not defined by spec:

- product question → Product answers and, if durable, updates spec/task;
- architecture question → involve Architect role, possibly ADR;
- incorrect spec → update canonical spec before resuming work.

Ideas the owner wants weighed but has not decided wait in `docs/product-inbox.md`. A Product session goes through them when it plans the next epic, and removes each one it turns into a spec, a ticket, a *Later* item or a rejection.

## The roadmap

A Product session, a checkpoint and autopilot at the end of its run keep the roadmap current. Its derived part, an epic's status from `tickets` on and the focus's *Done* line, follows from the tickets' statuses, so it is written without a yes, committed alone with a subject that says it is derived from the tickets, only when something changed, and never pushed. The focus's other prose and the `Next action:` are the owner's course, written only on the owner's yes, in a commit of their own; so are `not started` and `spec`, a Product session's. `docs/roadmap.md`, *Who writes what*, has the rule in full.

## Session rotation

Long Product chats are intentionally disposable.

Before closing/rotating:

```text
/binnacle:checkpoint
  ↓
extract only new durable delta
  ↓
show proposed persistence
  ↓
human confirms
  ↓
write to canonical sources
```

The next Product session rebuilds current state from Project Brain; it does not inherit a compressed transcript as its primary memory.
