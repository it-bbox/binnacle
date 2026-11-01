/**
 * The manifest `build.ts` writes for the published package (ADR-0044), kept apart from it so that a
 * test reads the published fields without running the build. The description and keywords are the
 * repository's identity strings, `docs/showcase/identity.md` (epic 24, ticket 04). `mcpName` is the
 * MCP Registry's ownership marker, which the Registry reads from the package on npm (ticket 14).
 */
export function publishManifest(cli: { version: string; engines: unknown }) {
  return {
    name: '@it-bbox/binnacle',
    version: cli.version,
    mcpName: 'io.github.it-bbox/binnacle',
    description: 'A local, provider-agnostic AI Engineering Control Plane: project memory, workflow and observability across coding agents.',
    keywords: [
      'ai',
      'ai-agents',
      'coding-agents',
      'claude-code',
      'codex',
      'mcp',
      'project-memory',
      'observability',
      'telemetry',
      'developer-tools',
      'workflow',
      'control-plane',
    ],
    license: 'Apache-2.0',
    type: 'module',
    bin: { binn: 'bin/binn.js', binnd: 'bin/binnd.js' },
    files: ['bin', 'dashboard', 'plugin', 'mod', 'skills', '.claude-plugin'],
    engines: cli.engines,
    repository: { type: 'git', url: 'git+https://github.com/it-bbox/binnacle.git' },
    homepage: 'https://github.com/it-bbox/binnacle#readme',
    bugs: { url: 'https://github.com/it-bbox/binnacle/issues' },
    publishConfig: { access: 'public' },
  };
}
