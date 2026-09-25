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
    description: 'The compact Product Snapshot: roadmap, Tasks in flight and ready to start, recent decisions, Git and attention items.',
  },
  daily_get: {
    operation: 'daily.get',
    description:
      'What changed since the previous daily on this machine: commits, Task transitions, new tickets, roadmap and ADR changes, what can start and attention items. Records this HEAD as the next baseline, unless `since` is given.',
    inputSchema: {
      since: z.string().optional().describe('A commit hash to look back from instead of the recorded baseline; records nothing.'),
    },
  },
  task_get: {
    operation: 'task.get',
    description:
      'The compact brief for starting one Task: its fields, its dependencies with their titles and states, its spec path, the ticket body without comments, and the branch name. Changes nothing.',
    inputSchema: {
      id: z.string().describe('The Task id: `<spec-slug>/<NN>` on the local tracker, `#<number>` or `<number>` on GitHub or GitLab.'),
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
 * Serves the tools on stdio until the client disconnects. Every call is made for `cwd`,
 * the directory the harness started the server in; a tool's own arguments, if it has any,
 * are passed to its operation unchanged.
 */
export async function serveStdio(version: string, cwd: string, call: CallDaemon): Promise<void> {
  const server = new McpServer({ name: 'binnacle', version });

  for (const [name, tool] of Object.entries(TOOLS)) {
    const run = async (args: Record<string, unknown> = {}) => {
      const answer = await call(tool.operation, { ...args, path: cwd });
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
