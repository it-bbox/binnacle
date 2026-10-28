import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WORDED_CODES, wordMessage, type Params } from '../src/index.ts';

/**
 * Core's Russian wording of the daemon's codes (spec `human-output`, *One Russian wording of
 * the daemon's codes*): every code is worded from its params, each variant of it too, and a
 * code with no wording or params it cannot use gives the daemon's English, marked.
 */

/** Values the wording maps to Russian, or leaves out, rather than passing through as written. */
const MAPPED = new Set(['kind', 'token', 'what', 'got', 'entity', 'warning', 'need', 'session', 'startedAt', 'lastActivityAt', 'own', 'from', 'otherFrom', 'neighbours', 'reason', 'thresholdSource', 'field']);

/** A session's times, as the daemon gives them. */
// Fifteen minutes around noon UTC, the same local day in every time zone.
const SESSION = { session: 's-1', startedAt: '2026-10-21T12:00:00Z', lastActivityAt: '2026-10-21T12:15:00Z' };

/** A time as the wording gives it, in this process's local time. */
const clock = (iso: string): string => {
  const at = new Date(iso);
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
};

/** One message per code and variant, with params as the daemon writes them. */
const EXAMPLES: [string, Params][] = [
  ['expected.mapping', { got: 'a list' }],
  ['expected.version', { expected: 1, got: 'string' }],
  ['expected.non_empty_string', {}],
  ['expected.string', {}],
  ['expected.string_or_null', {}],
  ['expected.one_of', { allowed: 'github, gitlab, local' }],
  ['expected.positive_integer', {}],
  ['expected.positive_integer', { or: 'all' }],
  ['expected.capability', {}],
  ['expected.range', { min: 1, max: 500 }],
  ['expected.hash', {}],
  ['expected.ancestor', {}],
  ['expected.alone', { other: 'task' }],
  ['expected.absolute_path', {}],
  ['expected.relative_path', {}],
  ['expected.array', {}],
  ['manifest.unknown_key', {}],
  ['manifest.unknown_language', { allowed: 'en, ru' }],
  ['yaml.syntax', { error: 'Unexpected token at line 3' }],
  ['project.shared_id', { id: 'demo', other: '/work/demo-copy' }],
  ['manifest.missing', { path: '/work/demo' }],
  ['manifest.invalid', { path: '/work/demo/.binnacle/project.yaml' }],
  ['manifest.invalid', { path: '/work/demo/.binnacle/project.yaml', count: 3 }],
  ['manifest.unsupported_version', { path: '/work/demo/.binnacle/project.yaml', version: 1 }],
  ['manifest.warning', { path: 'tracker.colour', warning: 'manifest.unknown_key' }],
  ['manifest.warning', { path: 'knowledge.language', warning: 'manifest.unknown_language', allowed: 'en, ru' }],
  ['roadmap.missing', { kind: 'docs' }],
  ['roadmap.missing', { kind: 'path', path: 'docs/roadmap.md' }],
  ['roadmap.missing', { kind: 'manifest' }],
  ['roadmap.focus_missing', {}],
  ['roadmap.table_missing', {}],
  ['roadmap.row_invalid', { line: 12, kind: 'cells', cells: 3, expected: 4 }],
  ['roadmap.row_invalid', { line: 12, kind: 'number', value: 'x' }],
  ['roadmap.row_invalid', { line: 12, kind: 'title' }],
  ['roadmap.row_invalid', { line: 12, kind: 'status', value: 'later', allowed: '"not started", "spec"' }],
  ['roadmap.row_invalid', { line: 12, kind: 'spec', value: 'tbd' }],
  ['roadmap.spec_missing', { epic: 4, title: 'Usage', status: 'tickets' }],
  ['roadmap.status_mismatch', { epic: 4, title: 'Usage', kind: 'done', tasks: 'usage/02, usage/03' }],
  ['roadmap.status_mismatch', { epic: 4, title: 'Usage', kind: 'not_started', spec: 'usage', count: 5 }],
  ['roadmap.status_mismatch', { epic: 4, title: 'Usage', kind: 'finished', status: 'in progress', spec: 'usage' }],
  ['roadmap.spec_unlisted', { path: 'docs/specs/usage/spec.md' }],
  ['next_action.missing', { kind: 'focus' }],
  ['next_action.missing', { kind: 'paragraph' }],
  ['next_action.stale', { command: '/binnacle:task run usage/02', tasks: 'usage/02 (docs/specs/usage/issues/02-a.md)' }],
  ['next_action.stale', { command: '/binnacle:autopilot 4', epic: 4, title: 'Usage', spec: 'usage', human: 'usage/05' }],
  ['task.not_found', { id: 'usage/09' }],
  ['task.unknown_state', { task: 'usage/02', ticket: 'docs/specs/usage/issues/02-a.md' }],
  ['task.unknown_state', { task: 'usage/02', ticket: 'docs/specs/usage/issues/02-a.md', status: 'WIP' }],
  ['task.unknown_role', { task: 'usage/02', ticket: 'docs/specs/usage/issues/02-a.md', role: 'Designer', roles: 'Developer, Reviewer' }],
  ['task.shared_branch', { branch: 'feat/a', task: 'usage/02', others: 'other/02 (docs/specs/other/issues/02-a.md)' }],
  ['task.dangling_dependency', { task: 'usage/02', ticket: 'docs/specs/usage/issues/02-a.md', dependency: 'usage/07' }],
  ['review.missing', { task: 'usage/02', ticket: 'docs/specs/usage/issues/02-a.md' }],
  ['tracker.remote_mismatch', { tracker: 'github.com/acme/app', remotes: 'git@gitlab.com:acme/app.git' }],
  ['tracker.issues_missing', { path: 'docs/specs' }],
  ['tracker.credentials_insecure', { path: '/home/u/.binnacle/credentials.json' }],
  ['tracker.unavailable', { kind: 'token', source: 'BINNACLE_GITHUB_TOKEN' }],
  ['tracker.unavailable', { kind: 'credentials_token', key: 'github.com', path: '/home/u/.binnacle/credentials.json' }],
  ['tracker.unavailable', { kind: 'credentials_unreadable', path: '/home/u/.binnacle/credentials.json', error: 'EACCES' }],
  ['tracker.unavailable', { kind: 'credentials_invalid', path: '/home/u/.binnacle/credentials.json' }],
  ['tracker.unavailable', { kind: 'manifest' }],
  ['tracker.unavailable', { kind: 'provider' }],
  ['tracker.unavailable', { kind: 'issues' }],
  ['tracker.unavailable', { kind: 'repository', provider: 'github' }],
  ['tracker.unavailable', { kind: 'unreadable' }],
  ['tracker.unreachable', { kind: 'url', where: 'acme/app at https://api.github.com' }],
  ['tracker.unreachable', { kind: 'list', forge: 'GitHub', where: 'acme/app at https://api.github.com', what: 'issues' }],
  ['tracker.unreachable', { kind: 'host', forge: 'GitHub', where: 'acme/app at https://api.github.com', origin: 'https://evil.test' }],
  ['tracker.unreachable', { kind: 'object', forge: 'GitLab', where: 'acme/app at https://gitlab.com/api/v4', what: 'repository' }],
  ['tracker.unreachable', { kind: 'error', forge: 'GitHub', where: 'acme/app at https://api.github.com', error: 'fetch failed' }],
  ['tracker.unreachable', { kind: 'status', forge: 'GitHub', where: 'acme/app at https://api.github.com', status: 502, what: 'issues', token: 'none' }],
  ['tracker.rate_limited', { forge: 'GitHub', where: 'acme/app at https://api.github.com', status: 429, what: 'issues', token: 'none' }],
  ['tracker.unauthorized', { forge: 'GitHub', where: 'acme/app at https://api.github.com', status: 401, what: 'issues', token: 'used' }],
  ['tracker.forbidden', { forge: 'GitHub', where: 'acme/app at https://api.github.com', status: 403, what: 'workflow runs', token: 'used' }],
  ['tracker.not_found', { forge: 'GitLab', where: 'acme/app at https://gitlab.com/api/v4', status: 404, what: 'pipelines', token: 'none' }],
  ['tracker.state_mismatch', { task: '#12', ticket: 'https://github.com/acme/app/issues/12', state: 'DONE' }],
  ['tracker.state_mismatch', { task: '#12', ticket: 'https://github.com/acme/app/issues/12', state: 'CANCELLED', status: 'DONE' }],
  ['transition.unknown_state', { entity: 'Task', states: '"LATER"' }],
  ['transition.terminal', { entity: 'Review', from: 'APPROVED', to: 'PENDING' }],
  ['transition.not_allowed', { entity: 'AgentRun', from: 'QUEUED', to: 'COMPLETED' }],
  ['epic.unknown', { epic: 9 }],
  ['epic.no_spec', { epic: 9, title: 'Release' }],
  ['adr.missing', { path: 'docs/adr' }],
  ['checkpoint.uncommitted', { path: 'docs/roadmap.md', head: '0123456789ab' }],
  ['checkpoint.path_missing', { path: 'docs/roadmp.md' }],
  ['git.not_a_repository', { kind: 'directory', path: '/work/gone' }],
  ['git.not_a_repository', { kind: 'repository', path: '/tmp' }],
  ['git.not_found', {}],
  ['git.timeout', { command: 'status', timeout: 5000 }],
  ['git.failed', { command: 'rev-parse', detail: 'fatal: bad object' }],
  ['git.no_commits', {}],
  ['ci.failing', { branch: 'main', commit: '0123456789ab', forge: 'GitHub', url: 'https://github.com/acme/app/actions/runs/1' }],
  ['ci.no_forge', {}],
  ['review.remote', {}],
  ['graph.unavailable', { kind: 'none' }],
  ['graph.unavailable', { kind: 'off' }],
  ['graph.unavailable', { kind: 'no_graphify' }],
  ['graph.unavailable', { kind: 'not_built', file: 'graphify-out/graph.json' }],
  ['graph.unavailable', { kind: 'unreadable', file: 'graphify-out/graph.json' }],
  ['harness.no_sessions', { harness: 'Claude Code', path: '/home/u/.claude/projects' }],
  ['usage.import_pending', {}],
  ['harness.no_export', { kind: 'database', harness: 'opencode' }],
  ['harness.no_export', { kind: 'session_files', harness: 'pi' }],
  ['harness.no_export', { kind: 'encrypted', harness: 'Antigravity' }],
  ['ponytail.no_comparison', { kind: 'no_commit' }],
  ['ponytail.no_comparison', { kind: 'unread' }],
  ['ponytail.no_comparison', { kind: 'none_before' }],
  ['ponytail.no_comparison', { kind: 'none_after' }],
  ['ponytail.no_comparison', { kind: 'neither' }],
  ['ponytail.no_comparison', { kind: 'remote' }],
  ['graph.update_failed', { commit: '0123456', reason: 'graphify exited with code 1.', kind: 'exit', exitCode: 1 }],
  ['graph.update_failed', { commit: '0123456', reason: 'boom', kept: '89abcde', kind: 'output', output: 'boom' }],
  ['graph.build_failed', { kind: 'output', output: 'error: refusing to overwrite graphify-out/graph.json' }],
  ['graph.build_failed', { kind: 'output', output: 'community detection failed', command: 'graphify cluster-only . --no-label' }],
  ['graph.build_failed', { kind: 'spawn', error: 'spawn /bin/graphify EACCES' }],
  ['graph.build_failed', { kind: 'signal', signal: 'SIGKILL' }],
  ['graph.build_failed', { kind: 'exit', exitCode: 2 }],
  ['graph.build_failed', { kind: 'recorded', output: 'graphify exited with code 1' }],
  ['impact.pair', { kind: 'shared', modules: 'src/a.ts, src/b.ts' }],
  ['impact.pair', { kind: 'neighbours', neighbours: 'src/a.ts, src/b.ts; src/c.ts, src/d.ts' }],
  ['impact.pair', { kind: 'apart' }],
  ['impact.pair', { kind: 'unmapped', task: 'a/03', from: 'ticket' }],
  ['impact.pair', { kind: 'unmapped', task: 'a/03', from: 'ticket', other: 'a/04', otherFrom: 'branch' }],
  ['graph.not_ignored', { directory: 'graphify-out', path: '/work/demo' }],
  ['telemetry.unreadable', { harness: 'Claude Code', what: '/home/u/.claude/projects/x.jsonl (EACCES)', others: 0 }],
  ['telemetry.unreadable', { harness: 'Codex', what: '/home/u/.codex/sessions (EACCES)', others: 3 }],
  ['context.pressure', { ...SESSION, harness: 'Claude Code', tokens: 180000, threshold: 150000 }],
  ['context.pressure', { ...SESSION, harness: 'Claude Code', tokens: 180000, threshold: 150000, own: true }],
  ['context.pressure', { ...SESSION, harness: 'Claude Code', tokens: 180000, threshold: 150000, own: false }],
  ['context.pressure', { ...SESSION, harness: 'Codex', at: '2026-10-21T10:00:00Z', trigger: 'auto', checkpoint: '2026-10-20T10:00:00Z' }],
  ['context.pressure', { ...SESSION, harness: 'Claude Code', tokens: 90000, at: '2026-10-21T10:00:00Z' }],
  ['context.pressure', { ...SESSION, harness: 'Claude Code', tokens: 180000, threshold: 150000, thresholdSource: 'manifest' }],
  ['context.pressure', { ...SESSION, harness: 'Claude Code', tokens: 180000, threshold: 150000, thresholdSource: 'model', model: 'claude-opus-5-5' }],
  ['context.pressure', { ...SESSION, harness: 'Claude Code', tokens: 180000, threshold: 150000, thresholdSource: 'machine' }],
  ['context.pressure', { ...SESSION, harness: 'Claude Code', tokens: 180000, threshold: 150000, thresholdSource: 'default' }],
  ['next.alternative', { kind: 'wait', task: 'a/01 (One)' }],
  ['next.alternative', { kind: 'wait', tasks: 'a/01 (One), a/02 (Two)' }],
  ['next.alternative', { kind: 'parallel', task: 'a/03 (Three)' }],
  ['next.alternative', { kind: 'parallel', tasks: 'a/03 (Three), a/04 (Four)' }],
  ['next.alternative', { kind: 'resume', task: 'a/01 (One)' }],
  ['next.alternative', { kind: 'autopilot', epic: 2, title: 'Release' }],
  ['next.alternative', { kind: 'byHand', task: 'a/03 (Three)' }],
  ['next.alternative', { kind: 'byHand', tasks: 'a/03 (Three), a/04 (Four)' }],
  ['next.alternative', { kind: 'owner', task: 'a/05 (Demo)' }],
  ['next.alternative', { kind: 'owner', tasks: 'a/05 (Demo), a/06 (Video)' }],
  ['next.alternative', { kind: 'blocked', epic: 2, title: 'Release', waits: 'a/02 (a/01); a/03 (a/01, a/04)' }],
  ['next.alternative', { kind: 'close', epic: 2, title: 'Release' }],
  ['next.alternative', { kind: 'plan', need: 'epics' }],
  ['next.alternative', { kind: 'plan', need: 'grilling', epic: 2, title: 'Release' }],
  ['next.alternative', { kind: 'plan', need: 'spec', epic: 2, title: 'Release' }],
  ['next.alternative', { kind: 'plan', need: 'tickets', epic: 2, title: 'Release' }],
  ['next.alternative', { kind: 'finished' }],
  ['parallel_limit.invalid', { kind: 'file', file: '/home/u/.binnacle/settings.json', limit: 2 }],
  ['parallel_limit.invalid', { kind: 'setting', file: '/home/u/.binnacle/settings.json', max: 16, limit: 2 }],
  ['parallel_limit.invalid', { kind: 'value', max: 16, got: '17' }],
  ['parallel_limit.invalid', { kind: 'value', max: 16, got: '-1.5' }],
  ['parallel_limit.invalid', { kind: 'value', max: 16, got: 'a string other than "auto"' }],
  ['context_pressure.invalid', { kind: 'file', file: '/home/u/.binnacle/settings.json', tokens: 150000 }],
  ['context_pressure.invalid', { kind: 'setting', file: '/home/u/.binnacle/settings.json', min: 1000, max: 200, tokens: 150000 }],
  ['context_pressure.invalid', { kind: 'value', min: 1000, max: 200, field: 'tokens', got: '999' }],
  ['context_pressure.invalid', { kind: 'value', min: 1000, max: 200, field: 'models', got: 'a list' }],
  ['context_pressure.invalid', { kind: 'value', min: 1000, max: 200, field: 'model', got: 'null' }],
  ['context_pressure.invalid', { kind: 'value', min: 1000, max: 200, field: 'name' }],
  ['settings.unreadable', { file: '/home/u/.binnacle/settings.json' }],
  ['vault.unwritable', { kind: 'settings', file: '/home/u/.binnacle/settings.json' }],
  ['vault.unwritable', { kind: 'path', file: '/home/u/.binnacle/settings.json' }],
  ['vault.unwritable', { kind: 'directory', path: '/home/u/vault' }],
  ['vault.unwritable', { kind: 'write', path: '/home/u/vault', error: 'EACCES' }],
  ['daemon.autostart_broken', { home: '/home/u/.binnacle', missing: '/usr/bin/node', command: 'binn daemon autostart on' }],
  ['registry.unreadable', { path: '/home/u/.binnacle/projects.json', kind: 'json', error: 'Unexpected end of JSON input' }],
  ['registry.unreadable', { path: '/home/u/.binnacle/projects.json', kind: 'projects' }],
  ['registry.unreadable', { path: '/home/u/.binnacle/projects.json', kind: 'entry' }],
  ['project.path_not_found', { path: '/work/gone' }],
  ['project.not_registered', { kind: 'registered', path: '/work/demo' }],
  ['project.not_registered', { kind: 'contains', path: '/work/demo/sub' }],
  ['request.invalid', { field: 'since' }],
  ['request.body_invalid', {}],
  ['request.body_too_large', { limit: 1048576 }],
  ['request.unsupported_media_type', { received: 'application/x-protobuf' }],
  ['request.not_found', { route: '/nope' }],
  ['request.method_not_allowed', { method: 'PUT', allowed: 'POST' }],
  ['request.forbidden_host', { host: 'evil.test', address: '127.0.0.1:7777' }],
  ['request.forbidden_origin', { origin: 'https://evil.test' }],
  ['operation.unknown', { operation: 'project.explode' }],
  ['auth.missing', {}],
  ['auth.invalid', {}],
  ['internal.error', {}],
];

const russian = (code: string, params: Params): string => {
  const worded = wordMessage('ru', { code, message: 'The daemon’s English.', params });
  assert.equal(worded.english, false, `${code} ${JSON.stringify(params)} fell back to English`);
  return worded.text;
};

describe("core's Russian wording", () => {
  it('has an example for every code it words', () => {
    const covered = new Set(EXAMPLES.map(([code]) => code));
    assert.deepEqual(WORDED_CODES.filter((code) => !covered.has(code)), []);
  });

  it('words each code from its params, in Russian, every value it is given written into the sentence', () => {
    for (const [code, params] of EXAMPLES) {
      const text = russian(code, params);
      assert.match(text, /[а-яё]/i, `${code}: ${text}`);
      for (const [name, value] of Object.entries(params)) {
        // A count of none is left unsaid, as in English.
        if (!MAPPED.has(name) && value !== 0) assert.ok(text.includes(String(value)), `${code}: ${name} ${JSON.stringify(value)} is not in «${text}»`);
      }
    }
  });

  it('words a variant by its own values, and Russian plurals by their number', () => {
    assert.equal(russian('review.missing', { task: 'a/01', ticket: 'x.md' }), 'Задача a/01 (x.md) готова, но в её тикете нет ревью в ## Comments.');
    assert.equal(russian('task.unknown_state', { task: 'a/01', ticket: 'x.md' }), 'В a/01 (x.md) нет строки Status:.');
    assert.equal(russian('task.unknown_state', { task: 'a/01', ticket: 'x.md', status: 'WIP' }), 'В a/01 (x.md) Status: «WIP» — не состояние задачи.');
    assert.equal(russian('manifest.invalid', { path: 'p.yaml', count: 1 }), 'В p.yaml 1 ошибка.');
    assert.equal(russian('manifest.invalid', { path: 'p.yaml', count: 3 }), 'В p.yaml 3 ошибки.');
    assert.equal(russian('manifest.invalid', { path: 'p.yaml', count: 5 }), 'В p.yaml 5 ошибок.');
    assert.equal(russian('manifest.warning', { path: 'tracker.colour', warning: 'manifest.unknown_key' }), 'tracker.colour: неизвестный ключ, пропущен: его написал более новый Binnacle или это опечатка.');
    assert.equal(russian('tracker.unauthorized', { forge: 'GitHub', where: 'a/b at h', token: 'none' }), 'GitHub отклонил запрос для a/b at h (401); запрос был без токена.');
    assert.equal(russian('expected.mapping', { got: 'a list' }), 'ожидается YAML-отображение, а здесь список');
    assert.equal(russian('request.method_not_allowed', { method: 'PUT', allowed: 'GET, HEAD' }), 'Метод «PUT» здесь не разрешён; используйте GET или HEAD.');
    assert.equal(russian('transition.unknown_state', { entity: 'Task', states: '"LATER", "SOON"' }), 'У задачи нет состояния "LATER" или "SOON".');
    // A Suggested step, one Task or several, agreeing with the count.
    assert.equal(russian('next.alternative', { kind: 'resume', task: 'a/01 (One)' }), 'a/01 (One) в работе, но ни один её запуск не активен. Продолжите её.');
    assert.equal(russian('next.alternative', { kind: 'owner', task: 'a/05 (Demo)' }), 'a/05 (Demo) готова к старту и в триаже ready-for-human: её делает владелец, а не агент.');
    assert.equal(
      russian('next.alternative', { kind: 'owner', tasks: 'a/05 (Demo), a/06 (Video)' }),
      'a/05 (Demo), a/06 (Video) готовы к старту и в триаже ready-for-human: их делает владелец, а не агент.',
    );
    assert.equal(russian('next.alternative', { kind: 'plan', need: 'spec', epic: 2, title: 'Release' }), 'Эпику 2 (Release) нужна спецификация.');
    // A pair's conflict risk by its kind, the modules and Task ids as they are.
    assert.equal(russian('impact.pair', { kind: 'shared', modules: 'nuxt.config.ts' }), 'Обе затрагивают nuxt.config.ts.');
    assert.equal(
      russian('impact.pair', { kind: 'neighbours', neighbours: 'src/a.ts, src/b.ts; src/c.ts, src/d.ts' }),
      'Их модули соседствуют в графе: src/a.ts и src/b.ts; src/c.ts и src/d.ts.',
    );
    assert.equal(russian('impact.pair', { kind: 'apart' }), 'Общих модулей нет, и их модули не соседствуют в графе.');
    assert.equal(russian('impact.pair', { kind: 'unmapped', task: 'a/03', from: 'ticket' }), 'Тикет a/03 не называет ни одного модуля графа.');
    assert.equal(
      russian('impact.pair', { kind: 'unmapped', task: 'a/03', from: 'ticket', other: 'a/04', otherFrom: 'branch' }),
      'Тикет a/03 не называет ни одного модуля графа; ветка a/04 не меняет ни одного модуля графа.',
    );
    // A failed Graphify run named in words, the tool's own output quoted as its.
    assert.equal(russian('graph.build_failed', { kind: 'output', output: 'it broke' }), 'Graphify сообщил: «it broke».');
    assert.equal(
      russian('graph.build_failed', { kind: 'output', output: 'it broke', command: 'graphify cluster-only . --no-label' }),
      'Graphify на шаге `graphify cluster-only . --no-label` сообщил: «it broke».',
    );
    assert.equal(russian('graph.build_failed', { kind: 'exit', exitCode: 2 }), 'Graphify завершился с кодом 2.');
    assert.equal(russian('graph.build_failed', { kind: 'recorded', output: 'graphify exited with code 1.' }), 'Graphify не построил граф; причина записана так: «graphify exited with code 1».');
    assert.equal(
      russian('graph.update_failed', { commit: '0123456', reason: 'it broke', kept: '89abcde', kind: 'output', output: 'it broke' }),
      'Обновление графа для 0123456 не удалось. Graphify сообщил: «it broke». Граф, построенный по 89abcde, сохранён.',
    );
    // A session named by its times, as this one or another only when the request said which it is, and the threshold in words.
    const pressure = { ...SESSION, harness: 'Claude Code', tokens: 180000, threshold: 150000 };
    const why = `в Claude Code, начатая в ${clock(SESSION.startedAt)}, последняя активность в ${clock(SESSION.lastActivityAt)}, прочитала 180000 токенов контекста в последнем вызове, не меньше порога в 150000 токенов. Запустите /binnacle:checkpoint и продолжайте в новой сессии.`;
    assert.equal(russian('context.pressure', pressure), `Продуктовая сессия ${why}`);
    assert.equal(russian('context.pressure', { ...pressure, own: true }), `Эта продуктовая сессия ${why}`);
    assert.equal(russian('context.pressure', { ...pressure, own: false }), `Другая продуктовая сессия ${why}`);
    // A start on another day than the latest activity is dated.
    const yesterday = { ...pressure, startedAt: '2026-10-20T09:30:00Z', lastActivityAt: '2026-10-21T21:30:00Z' };
    const started = new Date(yesterday.startedAt);
    const date = `${started.getFullYear()}-${String(started.getMonth() + 1).padStart(2, '0')}-${String(started.getDate()).padStart(2, '0')}`;
    assert.match(russian('context.pressure', yesterday), new RegExp(`, начатая в ${date} ${clock(yesterday.startedAt)}, последняя активность в ${clock(yesterday.lastActivityAt)},`));
    // The threshold named by its source (ADR-0046).
    const named = (thresholdSource: string, model?: string): string => russian('context.pressure', { ...pressure, thresholdSource, ...(model && { model }) });
    assert.match(named('manifest'), /, не меньше порога в 150000 токенов из telemetry\.context_pressure\.tokens\./);
    assert.match(named('model', 'claude-opus-5-5'), /, не меньше порога в 150000 токенов для claude-opus-5-5 на этой машине\./);
    assert.match(named('machine'), /, не меньше порога этой машины по умолчанию в 150000 токенов\./);
    assert.match(named('default'), /, не меньше порога по умолчанию в 150000 токенов\./);
    assert.equal(
      russian('context_pressure.invalid', { kind: 'value', min: 1000, max: 200, field: 'model', got: '0' }),
      'Пороги заполненности контекста — это tokens, порог по умолчанию, и models, число для каждого имени модели длиной от 1 до 200 символов; каждое — целое число не меньше 1000; 0 как число для модели не подходит.',
    );
  });

  it('gives English, as the daemon wrote it, in English', () => {
    assert.deepEqual(wordMessage('en', { code: 'review.missing', message: 'As written.', params: { task: 'a/01', ticket: 'x.md' } }), { text: 'As written.', english: false });
  });

  it('gives the English message, marked, for a code it does not know', () => {
    for (const code of ['nothing.known', 'toString', '__proto__']) {
      assert.deepEqual(wordMessage('ru', { code, message: 'As written.', params: {} }), { text: 'As written.', english: true });
    }
  });

  it('gives the English message, marked, for params it cannot use', () => {
    const unusable: [string, Params | undefined][] = [
      ['review.missing', undefined],
      ['review.missing', { task: 'a/01' }],
      ['epic.unknown', { epic: true as unknown as number }],
      ['manifest.invalid', { path: 'p.yaml', count: 'three' }],
      ['tracker.unavailable', { kind: 'nonsense' }],
      ['tracker.unavailable', { kind: 'toString' }],
      ['tracker.unreachable', { kind: 'list', forge: 'GitHub', where: 'w', what: 'gists' }],
      ['expected.mapping', { got: 'a tuple' }],
      ['manifest.warning', { path: 'x', warning: 'manifest.warning' }],
      ['manifest.warning', { path: 'x', warning: 'toString' }],
      ['next_action.stale', { command: '/binnacle:product' }],
      ['next.alternative', { kind: 'resume' }],
      ['next.alternative', { kind: 'plan', need: 'nothing' }],
      ['next.alternative', { kind: 'later' }],
      ['context.pressure', { session: 's-1', harness: 'Claude Code', tokens: 180000 }],
      ['context.pressure', { ...SESSION, harness: 'Claude Code', tokens: 180000, startedAt: 'yesterday' }],
      ['context.pressure', { ...SESSION, harness: 'Claude Code', tokens: 180000, own: 'yes' }],
      ['context.pressure', { ...SESSION, harness: 'Claude Code', tokens: 180000, threshold: 150000, thresholdSource: 'model' }],
      ['context.pressure', { ...SESSION, harness: 'Claude Code', tokens: 180000, threshold: 150000, thresholdSource: 'table' }],
      ['context_pressure.invalid', { kind: 'value', min: 1000, max: 200, field: 'everything', got: '0' }],
    ];
    for (const [code, params] of unusable) {
      assert.deepEqual(wordMessage('ru', { code, message: 'As written.', ...(params && { params }) }), { text: 'As written.', english: true }, `${code} ${JSON.stringify(params)}`);
    }
  });
});
