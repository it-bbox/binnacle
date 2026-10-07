import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { isAlive, OPENCODE_NO_EXPORT, readRuntime, resolvePort } from '@binnacle/daemon';
import { isRecord } from './history.ts';
import { CONFIG_HOME, onPath, VSCODE_USER_DIRECTORY } from './tools.ts';

/**
 * The OpenTelemetry export of each harness `binn init` and `binn audit` detect (spec of epic 10,
 * *`binn init`'s telemetry step*): for the harnesses that export, where their user-scope settings
 * are, whether those settings export to Binnacle, elsewhere or not at all, and the change that
 * points them at the daemon, JSON over HTTP, with prompt logging off; for the others, why not.
 */

/** What a harness's settings say about its export. `elsewhere`: settings of the harness's own that are not Binnacle's, naming what is there; `unreadable` why the file cannot be read. */
export type ExportState = { state: 'binnacle' } | { state: 'none' } | { state: 'elsewhere'; what: string } | { state: 'unreadable'; why: string };

export type Exporter = {
  name: string;
  /** The audit finding's code, `telemetry.export_<code>`. */
  code: string;
  executable: string;
  userDirectory: string;
  /** The user-scope settings file the export is configured in. */
  file: string;
  read(text: string | null, address: string): ExportState;
  /** The change shown in the plan: the keys merged into a JSON file, or the addition to a TOML one. */
  change(address: string): string;
  /** How the change is made, for the plan's heading. */
  how: 'merging into' | 'appending to';
  /** The whole file once the change is made, from a text `read` found readable. */
  next(text: string | null, address: string): string;
};

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/** A JSON settings file as an object: absent is empty; anything but an object is unreadable. */
function settings(text: string | null): Record<string, unknown> | string {
  if (text === null) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : 'it is not a JSON object';
  } catch {
    return 'it is not plain JSON';
  }
}

/** Claude Code's settings `env`: telemetry on, OTLP logs over HTTP in JSON to the daemon, which adds `/v1/logs`. Prompts are logged only with `OTEL_LOG_USER_PROMPTS`, never set. */
const claudeEnv = (address: string): Record<string, string> => ({
  CLAUDE_CODE_ENABLE_TELEMETRY: '1',
  OTEL_LOGS_EXPORTER: 'otlp',
  OTEL_EXPORTER_OTLP_PROTOCOL: 'http/json',
  OTEL_EXPORTER_OTLP_ENDPOINT: address,
});

/** Gemini CLI's `telemetry` block: its HTTP exporter is OTLP JSON, and it adds `/v1/logs`. `logPrompts` defaults to true, so it is set false. */
const geminiTelemetry = (address: string) => ({ enabled: true, target: 'local', otlpEndpoint: address, otlpProtocol: 'http', logPrompts: false });

/** Codex's `[otel]` table: its endpoint is taken as it is, so it names `/v1/logs`. */
const codexOtel = (address: string): string =>
  `[otel]\nexporter = { otlp-http = { endpoint = ${JSON.stringify(`${address}/v1/logs`)}, protocol = "json" } }\nlog_user_prompt = false\n`;

/**
 * ponytail: a textual check, as `namesBinnacle` is: an `[otel]` or `[otel.…]` table, or an `otel` key
 * at the start of a line, counts as an export configured, even under another table. It errs towards
 * leaving the file alone, since a second `[otel]` table would make it invalid; a TOML parser would tell them apart.
 */
const hasOtel = (toml: string): boolean => /^\s*(\[\s*otel\s*[\].]|otel\s*[=.])/m.test(toml);

export const exporters = (): Exporter[] => {
  const claude = process.env.CLAUDE_CONFIG_DIR?.trim() || join(homedir(), '.claude');
  const codex = process.env.CODEX_HOME?.trim() || join(homedir(), '.codex');
  return [
    {
      name: 'Claude Code',
      code: 'claude_code',
      executable: 'claude',
      // Detected as init detects it for its MCP registration, by ~/.claude; its settings are where CLAUDE_CONFIG_DIR puts them.
      userDirectory: join(homedir(), '.claude'),
      file: join(claude, 'settings.json'),
      how: 'merging into',
      read(text, address) {
        const parsed = settings(text);
        if (typeof parsed === 'string') return { state: 'unreadable', why: parsed };
        const env = parsed.env ?? {};
        if (!isRecord(env)) return { state: 'unreadable', why: 'its env is not an object' };
        if (Object.entries(claudeEnv(address)).every(([key, value]) => env[key] === value)) return { state: 'binnacle' };
        const set = Object.keys(env).filter((key) => key.startsWith('OTEL_'));
        return set.length > 0 ? { state: 'elsewhere', what: `its env sets ${set.join(', ')}` } : { state: 'none' };
      },
      change: (address) => json({ env: claudeEnv(address) }),
      next(text, address) {
        const parsed = settings(text) as Record<string, unknown>;
        return json({ ...parsed, env: { ...(parsed.env as object | undefined), ...claudeEnv(address) } });
      },
    },
    {
      name: 'Codex',
      code: 'codex',
      executable: 'codex',
      userDirectory: join(homedir(), '.codex'),
      file: join(codex, 'config.toml'),
      how: 'appending to',
      read(text, address) {
        if (text === null || !hasOtel(text)) return { state: 'none' };
        return text.includes(JSON.stringify(`${address}/v1/logs`)) ? { state: 'binnacle' } : { state: 'elsewhere', what: 'it has an [otel] table' };
      },
      change: codexOtel,
      next: (text, address) => `${text && !text.endsWith('\n') ? `${text}\n` : (text ?? '')}${codexOtel(address)}`,
    },
    {
      name: 'Gemini CLI',
      code: 'gemini_cli',
      executable: 'gemini',
      userDirectory: join(homedir(), '.gemini'),
      // Under GEMINI_CLI_HOME when it is set, as the daemon reads Gemini CLI's sessions.
      file: join(process.env.GEMINI_CLI_HOME?.trim() || homedir(), '.gemini', 'settings.json'),
      how: 'merging into',
      read(text, address) {
        const parsed = settings(text);
        if (typeof parsed === 'string') return { state: 'unreadable', why: parsed };
        const { telemetry } = parsed;
        if (telemetry === undefined) return { state: 'none' };
        if (isRecord(telemetry) && Object.entries(geminiTelemetry(address)).every(([key, value]) => telemetry[key] === value) && telemetry.outfile === undefined) return { state: 'binnacle' };
        return { state: 'elsewhere', what: 'it has a telemetry block' };
      },
      change: (address) => json({ telemetry: geminiTelemetry(address) }),
      next: (text, address) => json({ ...(settings(text) as object), telemetry: geminiTelemetry(address) }),
    },
  ];
};

/** The detected harnesses that export no OpenTelemetry Binnacle receives, and why. */
export const NO_EXPORT: { name: string; code: string; executable: string; userDirectory: string; reason: string }[] = [
  { name: 'opencode', code: 'opencode', executable: 'opencode', userDirectory: join(CONFIG_HOME, 'opencode'), reason: OPENCODE_NO_EXPORT },
  { name: 'VS Code', code: 'vscode', executable: 'code', userDirectory: VSCODE_USER_DIRECTORY, reason: 'Binnacle configures no OpenTelemetry export for VS Code, and reads none of its sessions' },
];

/** Why a harness is taken as installed, as `binn init` detects one: its executable on PATH, or its user directory. Null when it is not. */
export function detected({ executable, userDirectory }: { executable: string; userDirectory: string }): string | null {
  if (onPath(executable)) return `${executable} is on PATH`;
  if (existsSync(userDirectory)) return `${userDirectory} exists`;
  return null;
}

/**
 * The daemon's address an export points at: the running daemon's, else the one it binds when
 * started, `127.0.0.1` and `BINNACLE_PORT` or its default. Null when the daemon is not running and
 * its port is 0, any free one, which no setting can name.
 */
export function daemonAddress(home: string): string | null {
  const runtime = readRuntime(home);
  if (runtime && isAlive(runtime.pid)) return `http://${runtime.host}:${runtime.port}`;
  const port = resolvePort();
  return port === 0 ? null : `http://127.0.0.1:${port}`;
}

/** A settings file's text, or null when it is absent. */
export const settingsText = (file: string): string | null => (existsSync(file) ? readFileSync(file, 'utf8') : null);
