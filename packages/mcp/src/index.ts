import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { ErrorEnvelope } from '@binnacle/daemon';

/**
 * One daemon call, made by whoever knows how to reach the daemon (the CLI). It answers
 * with the operation's result or with the daemon's error envelope, never by throwing,
 * so an unreachable daemon is a tool error rather than a failed server.
 */
export type CallDaemon = (operation: string, body: { path: string }) => Promise<{ result: unknown } | ErrorEnvelope>;

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
} as const;

/**
 * Serves the tools on stdio until the client disconnects. Every call is made for `cwd`,
 * the directory the harness started the server in; the tools take no arguments.
 */
export async function serveStdio(version: string, cwd: string, call: CallDaemon): Promise<void> {
  const server = new McpServer({ name: 'binnacle', version });

  for (const [name, { operation, description }] of Object.entries(TOOLS)) {
    server.registerTool(name, { description }, async () => {
      const answer = await call(operation, { path: cwd });
      return 'error' in answer
        ? { isError: true, content: [{ type: 'text', text: JSON.stringify(answer) }] }
        : { content: [{ type: 'text', text: JSON.stringify(answer.result) }] };
    });
  }

  await server.connect(new StdioServerTransport());
}
