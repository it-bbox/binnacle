import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { ErrorEnvelope } from '@binnacle/daemon';
import { z } from 'zod';

/**
 * One daemon call, made by whoever knows how to reach the daemon (the CLI). It answers
 * with the operation's result or with the daemon's error envelope, never by throwing,
 * so an unreachable daemon is a tool error rather than a failed server.
 */
export type CallDaemon = (operation: string, body: { path: string; since?: string | undefined }) => Promise<{ result: unknown } | ErrorEnvelope>;

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
} as const;

/**
 * Serves the tools on stdio until the client disconnects. Every call is made for `cwd`,
 * the directory the harness started the server in; a tool's own arguments, if it has any,
 * are passed to its operation unchanged.
 */
export async function serveStdio(version: string, cwd: string, call: CallDaemon): Promise<void> {
  const server = new McpServer({ name: 'binnacle', version });

  for (const [name, tool] of Object.entries(TOOLS)) {
    const run = async (args: { since?: string | undefined } = {}) => {
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
