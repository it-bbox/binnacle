import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { ErrorEnvelope } from '@binnacle/daemon';
import { z } from 'zod';

/**
 * One daemon call, made by whoever knows how to reach the daemon (the CLI). It answers
 * with the operation's result or with the daemon's error envelope, never by throwing,
 * so an unreachable daemon is a tool error rather than a failed server.
 */
export type CallDaemon = (operation: string, body: { path: string } & Record<string, unknown>) => Promise<{ result: unknown } | ErrorEnvelope>;

/**
 * One tool per daemon operation (spec, *MCP server*). Names use underscores because the
 * Anthropic API accepts only `[a-zA-Z0-9_-]` in tool names. Administration —
 * register, unregister, list, events, daemon status — stays with the CLI.
 */
const TOOLS = {
  project_detect: {
    operation: 'project.detect',
    description: 'Identify the Binnacle project containing this session\'s working directory.',
  },
  project_status: {
    operation: 'project.status',
    description: 'Manifest facts and live Git facts for this session\'s checkout.',
  },
  project_snapshot: {
    operation: 'project.snapshot',
    description: "The compact Product Snapshot: roadmap, the roadmap's Next action with its command and Binnacle's alternatives beside it (the Suggested step), Tasks in flight and ready to start with the command that starts each and their roles (`roles`: `required`, from the ticket's `Roles:` line or Developer and Reviewer by `default`, and `suggested`, Binnacle's `calculated` suggestions, each with its reason) and their `questions` (`asked`, `unanswered`), what waits for the owner (`pendingDecisions`: the unanswered `questions`, each with its Task and the branch it was read from, the `approvals` in READY_FOR_REVIEW and the `owner`'s ready-for-human Tasks ready to start), the runs running now and recently, recent decisions, CI as the forge reports it (`ci`: the default branch's latest commit and the open pull or merge requests, each with its state and the Task its branch maps to), usage, Git and attention items.",
  },
  daily_get: {
    operation: 'daily.get',
    description:
      'What changed since the previous daily on this machine: commits, Task transitions, new tickets, roadmap and ADR changes, what can start, what waits for the owner as of now (`pendingDecisions`, as the snapshot gives it), CI as of now (`ci`, as the snapshot gives it) and attention items. Records this HEAD as the next baseline, unless `since` is given.',
    inputSchema: {
      since: z.string().optional().describe('A commit hash to look back from instead of the recorded baseline; records nothing.'),
    },
  },
  task_get: {
    operation: 'task.get',
    description:
      'The compact brief for starting one Task: its fields, its roles (`roles`: `required`, from the ticket\'s `Roles:` line, or Developer and Reviewer when `source` is `default`, and `suggested`, an Architect or Security, each with its `reason`, `calculated` from the graph and the ticket\'s text, never written to the ticket), its dependencies with their titles and states, its spec path, the ticket body without comments, the branch name, the command that starts it in a fresh session (`start`, null for a DONE or CANCELLED Task or another workflow), and its Review as the ticket records it (`review`: null when there is none, not available on GitHub or GitLab), its questions, each with its options in its text and its answer, or null while unanswered, read without the date line above it (`questions`: read from the ticket on the Task\'s branch while that branch is unmerged, which `branch` names, and from the checkout otherwise; on GitHub or GitLab from the issue\'s comments that start with `### Question` or `### Answer`, in the order they were made, or not available, with the reason, when they cannot be read), its pull or merge request (`request`: the open one its branch maps to, with its number, title, branch, draft, link, `forge` and CI `state` as the forge reports it, null when there is none, or not available, with the reason, as the snapshot\'s `ci` is), with a diagnostic when another Task has the same branch, and its token usage by role (`byRole`: implementation, review and rework, each `calculated` from the branch\'s runs and commits, as `usage_get` says, or on GitHub or GitLab from the first review requesting changes on its pull or merge request), and `reworkUnread`, why rework is not read there, without a token or such a request, null when it is. Changes nothing.',
    inputSchema: {
      id: z.string().describe('The Task id: `<spec-slug>/<NN>` on the local tracker, `#<number>` or `<number>` on GitHub or GitLab.'),
    },
  },
  usage_get: {
    operation: 'usage.get',
    description:
      'Token usage read from the harnesses\' session artifacts: without `task`, the project\'s totals by Task and unassigned, by role (product, implementation, review, rework, unknown), and `derived`, Binnacle\'s calculations, each labelled `calculated`: tokens and runs per DONE Task with their mean, runs per Task with the subagents\' apart, totals per calendar week from Monday, each DONE Task\'s rework share (rework tokens over implementation and rework tokens, null when its rework is not read) with their mean, first-pass acceptance (the share of reviewed DONE Tasks with no rework run), each run\'s context growth (input, cached input and cache creation of its first, latest and largest call, null when not reported), and the mean tokens per DONE Task completed before and after Ponytail, dated by the first commit on the default branch naming it in AGENTS.md or CLAUDE.md, each Task by the commit that set it DONE, or the reason there is no comparison; with `task`, that Task\'s totals, the same by role, and its runs, newest first. Review is the work of a subagent that starts on the Task\'s branch after the branch\'s first commit changing anything but its ticket; rework is the other work on that branch after the first such subagent\'s last record, or, for a Task with no such subagent, after the commit that first records the ticket\'s Review, or, on GitHub or GitLab, after the first review requesting changes on the pull or merge request whose head is the branch, read with the tracker\'s token, `reworkUnread` saying why when it is not; both are Binnacle\'s calculation. Tokens only, never cost; a field no harness reported is null.',
    inputSchema: {
      task: z.string().optional().describe('A Task id, in the forms task_get takes; omit it for the whole project.'),
    },
  },
  checkpoint_prepare: {
    operation: 'checkpoint.prepare',
    description:
      'Before closing a Product session: what changed since the last checkpoint, where each kind of durable decision belongs in this project (promotion targets with their paths), and attention items. Records nothing and writes nothing.',
  },
  checkpoint_record: {
    operation: 'checkpoint.record',
    description:
      'After the session has written and committed the promotions the human confirmed: records the checkpoint at this HEAD with what was promoted. Binnacle writes no file. Returns a diagnostic for each promoted path still uncommitted.',
    inputSchema: {
      // The daemon validates both fields; the types are listed here only to guide the caller.
      promoted: z
        .array(z.object({ type: z.string(), path: z.string() }))
        .describe('What was promoted, empty if nothing: type is vocabulary, trade_off, new_work, product_rule or position; path is relative to the project directory.'),
    },
  },
} as const;

/**
 * The daemon call behind a tool and its arguments, read as the server reads them: a tool with no
 * schema takes none, one with a schema keeps only the fields it names, and `path` is always `cwd`.
 * `binn call` makes its calls through here, so a tool exists in both or in neither. A name that is
 * not a tool, or arguments its schema refuses, give the reason instead.
 */
export function toolRequest(name: string, args: unknown, cwd: string): { operation: string; body: { path: string } & Record<string, unknown> } | { refused: string } {
  if (!Object.hasOwn(TOOLS, name)) return { refused: `unknown tool ${JSON.stringify(name)}` };
  const tool = TOOLS[name as keyof typeof TOOLS];
  if (!('inputSchema' in tool)) return { operation: tool.operation, body: { path: cwd } };
  const parsed = z.object(tool.inputSchema as Record<string, z.ZodType>).safeParse(args);
  if (!parsed.success) return { refused: `${name} does not take these arguments: ${z.prettifyError(parsed.error).replaceAll('\n', ' ')}` };
  return { operation: tool.operation, body: { ...parsed.data, path: cwd } };
}

/** Every tool with its description, then each argument with its description and whether it may be left out: `binn call --help`. */
export function toolsHelp(): string {
  return Object.entries(TOOLS)
    .map(([name, tool]) => {
      const args = Object.entries('inputSchema' in tool ? (tool.inputSchema as Record<string, z.ZodType>) : {}).map(
        ([arg, schema]) => `      ${arg}${schema.safeParse(undefined).success ? ' (optional)' : ''}: ${schema.description ?? ''}`,
      );
      return [`  ${name}`, `      ${tool.description}`, ...args].join('\n');
    })
    .join('\n\n');
}

/**
 * Serves the tools on stdio until the client disconnects. Every call is made for `cwd`,
 * the directory the harness started the server in; a tool's own arguments, if it has any,
 * are passed to its operation unchanged.
 */
export async function serveStdio(version: string, cwd: string, call: CallDaemon): Promise<void> {
  const server = new McpServer({ name: 'binnacle', version });

  for (const [name, tool] of Object.entries(TOOLS)) {
    const run = async (args: Record<string, unknown> = {}) => {
      // The SDK has already checked the arguments against the same schema, so the request is never refused here.
      const request = toolRequest(name, args, cwd) as { operation: string; body: { path: string } & Record<string, unknown> };
      const answer = await call(request.operation, request.body);
      return 'error' in answer
        ? { isError: true, content: [{ type: 'text' as const, text: JSON.stringify(answer) }] }
        : { content: [{ type: 'text' as const, text: JSON.stringify(answer.result) }] };
    };
    // A tool with no schema is registered without one, so that a call carrying no
    // arguments at all is still valid; the SDK rejects that against any schema.
    if ('inputSchema' in tool) server.registerTool(name, { description: tool.description, inputSchema: tool.inputSchema }, run);
    else server.registerTool(name, { description: tool.description }, () => run());
  }

  await server.connect(new StdioServerTransport());
}
