# Git, Tracker and Worktrees

## Tracker policy

For serious remote projects:

- GitHub remote → prefer GitHub Issues;
- GitLab remote → prefer GitLab Issues/work items;
- local/offline/small → Local Markdown adapter is allowed.

Binnacle does not become the canonical tracker.

## Git strategy

Use a simple trunk-based-ish workflow:

```text
main
  ↑
PR/MR
  ↑
task branch
  ↑
optional task worktree
```

No complex GitFlow unless a project explicitly requires it.

## Worktrees

Worktrees isolate working directories; they do not guarantee merge-conflict freedom.

Use only after task dependency/impact review. Begin with max two parallel development tasks.

### Parallelism decision inputs

- task dependency edges;
- declared scope;
- Graphify impact/dependency hints when available;
- likely/shared files or domains;
- git co-change history later if useful.

The result is a recommendation, never a guarantee.

## Scratch policy with worktrees

Do not share one writable `.scratch` filesystem between concurrent worktrees.

Each task worktree gets task-local materialized scratch content:

```text
worktrees/INT-143/
└── .scratch/INT-143/
```

Canonical task state remains in tracker/Binnacle/durable docs.

After Task completion:

1. promote durable knowledge;
2. preserve telemetry/event history;
3. merge/close task;
4. remove worktree;
5. delete disposable scratch.

## Merge safety

Before merging a long-running branch, update against current main, resolve conflicts explicitly and rerun appropriate checks.
