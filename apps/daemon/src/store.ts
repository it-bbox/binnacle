import { chmodSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { ImportWindow } from '@binnacle/core';
import type { TelemetryRecord } from '@binnacle/adapters';
import type { CompactionMarker, Harness, Provenance, TokenField, UsageLimitMarker, UsageRecord } from '@binnacle/telemetry';
import { OWNER_ONLY_FILE, storePath } from './home.ts';

/**
 * The machine-level store: one database per Binnacle home (ADR-0015).
 *
 * Two tiers live here. `project` is a **projection**, derived from the registry file
 * and each repository's manifest, and it is rebuilt rather than migrated. The
 * append-only tier — events, the usage records, compaction and usage-limit markers ingested from harness
 * artifacts with the cursors they were read up to, and the records received through
 * OpenTelemetry — is migrated and
 * never recreated, because it is the only copy of what was observed.
 *
 * The daemon is the only process that opens this file. The CLI and the dashboard
 * reach state through the API.
 */
export const SCHEMA_VERSION = 1;

export type ProjectRow = {
  /** Null when the manifest could not be read, because an id is read from it and never invented. */
  id: string | null;
  name: string | null;
  path: string;
  registeredAt: string;
  /** Why this registered path could not be projected, or null when it projected cleanly. */
  unavailable: string | null;
  /**
   * A digest of the whole validated manifest, so that a change to any field is visible
   * — not only to the two this row happens to carry.
   */
  manifestDigest: string | null;
};


export type EventRow = {
  id: number;
  type: string;
  projectPath: string | null;
  occurredAt: string;
  payload: Record<string, unknown>;
  provenance: Provenance;
};

export type NewEvent = {
  type: string;
  projectPath?: string | null;
  payload?: Record<string, unknown>;
  provenance?: Provenance;
};

export type EventFilter = {
  path?: string | undefined;
  since?: string | undefined;
  until?: string | undefined;
  limit?: number | undefined;
};

/** How far one artifact file has been read, and under which import window. */
export type IngestCursor = { path: string; size: number; offset: number; line: number; windowDays: ImportWindow };

/** A record to store, with the registered project its `cwd` lies in and the file it was read from. */
export type Ingested = { record: UsageRecord; projectPath: string; sourceRef: string };
/** A compaction marker to store, as a record is. */
export type IngestedMarker = { marker: CompactionMarker; projectPath: string; sourceRef: string };
/** A usage-limit marker to store, as a record is. */
export type IngestedLimit = { limit: UsageLimitMarker; projectPath: string; sourceRef: string };

/** Where a record comes from: a harness's session artifact, or its OpenTelemetry export. */
type RecordSource = 'artifact' | 'opentelemetry';

/** A record received through OpenTelemetry and not yet in any project, with when it arrived. */
export type Unattributed = { record: TelemetryRecord; receivedAt: string };

/**
 * How far apart an artifact's call and an OpenTelemetry event may be, in seconds, and still be
 * the same call when no request id tells them apart: each harness stamps the call at its own moment.
 */
export const SAME_CALL_WITHIN_S = 5;

export const EVENT_LIMIT_DEFAULT = 50;
export const EVENT_LIMIT_MAX = 500;

export type Store = {
  projects(): ProjectRow[];
  project(path: string): ProjectRow | null;
  putProject(row: ProjectRow): void;
  dropProjectsExcept(paths: string[]): void;
  appendEvent(event: NewEvent): void;
  events(filter?: EventFilter): EventRow[];
  latestEvent(projectPath: string, types: readonly string[]): EventRow | null;
  cursor(path: string): IngestCursor | null;
  /** Forgets the cursor of every file whose path starts with `prefix`, so that each is read again from the start. */
  forgetCursors(prefix: string): void;
  /** Stores the records and markers a file gave and moves its cursor, together or not at all. One already stored is left as it was. */
  ingest(cursor: IngestCursor, records: Ingested[], markers?: IngestedMarker[], limits?: IngestedLimit[]): void;
  /** A project's compaction markers, of every harness, oldest first. */
  compactions(projectPath: string): CompactionMarker[];
  /** A project's usage-limit markers from `since` on, an ISO timestamp, of every harness, oldest first. */
  usageLimits(projectPath: string, since: string): UsageLimitMarker[];
  /**
   * A project's records, of every harness, from `since` on, an ISO timestamp, each call counted
   * once: an OpenTelemetry record that is the same call as an artifact record of its session is
   * left out, the artifact's kept. The same call is the one with the same request id when both
   * have one, otherwise the one with the same model and token counts within `SAME_CALL_WITHIN_S`,
   * a count the event does not report matching any.
   *
   * ponytail: without a request id the match is not one to one, so two identical calls of a
   * session within the window, only one of them in its artifact yet, count once until the
   * artifact has the other; pair records off if a harness without request ids ever makes that common.
   */
  usage(projectPath: string, since: string): UsageRecord[];
  /**
   * How many of a project's records of one harness there are, how many report any token count,
   * and how many arrived through OpenTelemetry at `liveSince` or later, an ISO timestamp: the
   * project's, and the harness's still in no project, since a harness's events arriving make it
   * live whether or not a project is known for them yet.
   * ponytail: a record in no project makes its harness live in every project; tell them apart
   * if a harness's level must ever say which project its live session is in.
   */
  usageCounts(projectPath: string, harness: Harness, liveSince: string): { records: number; withTokens: number; live: number };
  /** Keeps records received through OpenTelemetry in no project, until `attribute` moves them; one already received is left as it was. */
  receive(records: TelemetryRecord[]): void;
  /** The records received for a session of `harness` that are still in no project. */
  unattributed(harness: Harness, sessionId: string): Unattributed[];
  /**
   * Where a session's artifact says it ran at `timestamp`: the directory and project of its
   * latest main-session record at or before it, else its first; null when no artifact record is stored.
   */
  sessionPlace(harness: Harness, sessionId: string, timestamp: string): { cwd: string; projectPath: string } | null;
  /** Moves a received record into its project, as an OpenTelemetry record that arrived at `receivedAt`. */
  attribute(record: UsageRecord, projectPath: string, receivedAt: string): void;
  close(): void;
};

export function openStore(home: string): Store {
  const path = storePath(home);
  const db = new DatabaseSync(path);
  // The 0700 home directory is what protects the WAL sidecars; this covers the database itself.
  try {
    chmodSync(path, OWNER_ONLY_FILE);
  } catch {
    // Windows ignores POSIX modes, and the home directory's ACL is the boundary there.
  }

  db.exec('pragma journal_mode = wal');
  // Before the compaction table, a cursor may be past compaction boundaries never stored.
  const markersNew = db.prepare("select 1 from sqlite_master where type = 'table' and name = 'compaction'").get() === undefined;
  // Before the usage-limit table, likewise, past usage-limit records.
  const limitsNew = db.prepare("select 1 from sqlite_master where type = 'table' and name = 'usage_limit'").get() === undefined;
  // The append-only tier first: it is migrated, never dropped, so it exists before any
  // decision about the projections is made — including the event that records one.
  db.exec(`
    create table if not exists meta (
      key text primary key,
      value text not null
    );
    create table if not exists event (
      id integer primary key autoincrement,
      type text not null,
      project_path text,
      occurred_at text not null,
      payload text not null,
      provenance text not null
    );
    create index if not exists event_recent on event (occurred_at desc, id desc);
    create table if not exists ingested_record (
      id integer primary key autoincrement,
      harness text not null,
      natural_key text not null,
      project_path text not null,
      session_id text not null,
      subagent_id text,
      parent_session text,
      source_ref text not null,
      timestamp text not null,
      cwd text not null,
      branch text,
      branch_source text,
      provider text,
      model text,
      input integer,
      cached_input integer,
      cache_creation integer,
      output integer,
      reasoning integer,
      provenance text not null,
      ingested_at text not null,
      unique (harness, natural_key)
    );
    create index if not exists ingested_record_project on ingested_record (project_path, harness, timestamp);
    create table if not exists unattributed_record (
      harness text not null,
      natural_key text not null,
      session_id text not null,
      request_id text,
      timestamp text not null,
      provider text,
      model text,
      input integer,
      cached_input integer,
      cache_creation integer,
      output integer,
      reasoning integer,
      provenance text not null,
      received_at text not null,
      primary key (harness, natural_key)
    );
    create table if not exists compaction (
      harness text not null,
      natural_key text not null,
      project_path text not null,
      session_id text not null,
      subagent_id text,
      source_ref text not null,
      timestamp text not null,
      cwd text not null,
      trigger text,
      provenance text not null,
      primary key (harness, natural_key)
    );
    create index if not exists compaction_project on compaction (project_path, timestamp);
    create table if not exists usage_limit (
      harness text not null,
      natural_key text not null,
      project_path text not null,
      session_id text not null,
      subagent_id text,
      source_ref text not null,
      timestamp text not null,
      cwd text not null,
      limit_type text,
      provenance text not null,
      primary key (harness, natural_key)
    );
    create index if not exists usage_limit_project on usage_limit (project_path, timestamp);
    create table if not exists ingest_cursor (
      path text primary key,
      size integer not null,
      offset integer not null,
      line integer not null,
      window_days integer not null
    );
  `);

  // The append-only tier's migrations: each column added once, to a table that may already hold rows.
  const columns = new Set(db.prepare('pragma table_info(ingested_record)').all().map((column) => String(column.name)));
  if (!columns.has('source')) db.exec("alter table ingested_record add column source text not null default 'artifact'");
  if (!columns.has('request_id')) db.exec('alter table ingested_record add column request_id text');
  db.exec('create index if not exists ingested_record_session on ingested_record (harness, session_id)');
  // Every artifact is read again from its start once, for its markers; its records are stored already and stay as they were.
  if (markersNew || limitsNew) db.exec('delete from ingest_cursor');

  const insertEvent = db.prepare(
    'insert into event (type, project_path, occurred_at, payload, provenance) values (?, ?, ?, ?, ?)',
  );
  const appendEvent = (event: NewEvent): void => {
    insertEvent.run(
      event.type,
      event.projectPath ?? null,
      new Date().toISOString(),
      JSON.stringify(event.payload ?? {}),
      event.provenance ?? 'measured',
    );
  };

  // ADR-0015: projections are never migrated. A store another Binnacle wrote has every
  // projection table dropped and recreated empty, and the caller re-derives it from the
  // registry file (ADR-0019), as it does on every start. A fresh store has no version to
  // differ from, so nothing is rebuilt there. The drop, the new version and the event
  // that records them commit together, and the version is read inside that transaction.
  //
  // ponytail: an older Binnacle meeting a newer store rebuilds the projections like any
  // mismatch, but the event table is assumed readable. The first migration of that table
  // is where a downgrade needs a refusal instead.
  db.exec('begin immediate');
  try {
    const stored = db.prepare('select value from meta where key = ?').get('schema_version')?.value;
    if (stored !== undefined && stored !== String(SCHEMA_VERSION)) {
      db.exec('drop table if exists project');
      appendEvent({ type: 'store.rebuilt', payload: { from: Number(stored), to: SCHEMA_VERSION } });
    }
    db.exec(`
      create table if not exists project (
        path text primary key,
        id text,
        name text,
        registered_at text not null,
        unavailable text,
        manifest_digest text
      );
    `);
    db.prepare('insert or replace into meta (key, value) values (?, ?)').run('schema_version', String(SCHEMA_VERSION));
    db.exec('commit');
  } catch (error) {
    // SQLite has already rolled back on some failures, and a second rollback would throw
    // over the error that explains what went wrong.
    if (db.isTransaction) db.exec('rollback');
    db.close();
    throw error;
  }

  const insertRecord = db.prepare(`
    insert into ingested_record (harness, natural_key, project_path, session_id, subagent_id, parent_session, source_ref, timestamp, cwd,
      branch, branch_source, provider, model, input, cached_input, cache_creation, output, reasoning, provenance, ingested_at, source, request_id)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict (harness, natural_key) do nothing
  `);
  /** Runs `body` as one write transaction: all of it commits, or none of it. */
  const transaction = (body: () => void): void => {
    db.exec('begin immediate');
    try {
      body();
      db.exec('commit');
    } catch (error) {
      if (db.isTransaction) db.exec('rollback');
      throw error;
    }
  };
  const insertRecordRow = (record: UsageRecord, projectPath: string, sourceRef: string, ingestedAt: string, source: RecordSource): void => {
    const { input, cachedInput, cacheCreation, output, reasoning } = record.tokens;
    insertRecord.run(
      record.harness, record.naturalKey, projectPath, record.sessionId, record.subagentId, record.parentSession, sourceRef,
      record.timestamp, record.cwd,
      record.branch?.name ?? null, record.branch?.source ?? null, record.provider, record.model,
      input, cachedInput, cacheCreation, output, reasoning, record.provenance, ingestedAt, source, record.requestId,
    );
  };
  const insertMarker = db.prepare(`
    insert into compaction (harness, natural_key, project_path, session_id, subagent_id, source_ref, timestamp, cwd, trigger, provenance)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict (harness, natural_key) do nothing
  `);
  const selectMarkers = db.prepare(`
    select harness, natural_key, session_id, subagent_id, timestamp, cwd, trigger, provenance from compaction
    where project_path = ? order by timestamp, natural_key
  `);
  const insertLimit = db.prepare(`
    insert into usage_limit (harness, natural_key, project_path, session_id, subagent_id, source_ref, timestamp, cwd, limit_type, provenance)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict (harness, natural_key) do nothing
  `);
  const selectLimits = db.prepare(`
    select harness, natural_key, session_id, subagent_id, timestamp, cwd, limit_type, provenance from usage_limit
    where project_path = ? and timestamp >= ? order by timestamp, natural_key
  `);
  const insertUnattributed = db.prepare(`
    insert into unattributed_record (harness, natural_key, session_id, request_id, timestamp, provider, model,
      input, cached_input, cache_creation, output, reasoning, provenance, received_at)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict (harness, natural_key) do nothing
  `);
  const selectUnattributed = db.prepare(`
    select harness, natural_key, session_id, request_id, timestamp, provider, model, input, cached_input, cache_creation, output, reasoning,
      provenance, received_at
    from unattributed_record where harness = ? and session_id = ? order by timestamp
  `);
  const deleteUnattributed = db.prepare('delete from unattributed_record where harness = ? and natural_key = ?');
  // A main session's record before a subagent's; of them, the latest at or before the time, else the first after it.
  const selectPlace = db.prepare(`
    select cwd, project_path from ingested_record
    where harness = ?1 and session_id = ?2 and source = 'artifact'
    order by subagent_id is not null, timestamp > ?3, case when timestamp > ?3 then timestamp end, timestamp desc
    limit 1
  `);
  // `window_days` holds `all` as text: SQLite keeps a value its column's type cannot convert as it is.
  const upsertCursor = db.prepare(`
    insert into ingest_cursor (path, size, offset, line, window_days) values (?, ?, ?, ?, ?)
    on conflict (path) do update set size = excluded.size, offset = excluded.offset, line = excluded.line, window_days = excluded.window_days
  `);
  const selectCursor = db.prepare('select path, size, offset, line, window_days from ingest_cursor where path = ?');
  const deleteCursors = db.prepare('delete from ingest_cursor where substr(path, 1, length(?1)) = ?1');
  const selectUsage = db.prepare(`
    select harness, natural_key, session_id, subagent_id, parent_session, timestamp, cwd, branch, branch_source, provider, model, provenance,
      request_id, input, cached_input, cache_creation, output, reasoning
    from ingested_record r where project_path = ? and timestamp >= ?
      and not (source = 'opentelemetry' and exists (
        select 1 from ingested_record a
        where a.harness = r.harness and a.session_id = r.session_id and a.source = 'artifact'
          and case when a.request_id is not null and r.request_id is not null then a.request_id = r.request_id
            else a.model is r.model
              and (r.input is null or a.input is r.input) and (r.cached_input is null or a.cached_input is r.cached_input)
              and (r.cache_creation is null or a.cache_creation is r.cache_creation) and (r.output is null or a.output is r.output)
              and (r.reasoning is null or a.reasoning is r.reasoning)
              and abs(unixepoch(a.timestamp, 'subsec') - unixepoch(r.timestamp, 'subsec')) <= ${SAME_CALL_WITHIN_S}
            end
      ))
  `);
  const countUsage = db.prepare(`
    select count(*) as records,
      count(case when coalesce(input, cached_input, cache_creation, output, reasoning) is not null then 1 end) as with_tokens,
      count(case when source = 'opentelemetry' and ingested_at >= ? then 1 end) as live
    from ingested_record where project_path = ? and harness = ?
  `);
  const countUnattributed = db.prepare('select count(*) as live from unattributed_record where harness = ? and received_at >= ?');

  const COLUMNS = 'path, id, name, registered_at, unavailable, manifest_digest';
  const selectAll = db.prepare(`select ${COLUMNS} from project order by id`);
  const selectOne = db.prepare(`select ${COLUMNS} from project where path = ?`);
  const upsert = db.prepare(`
    insert into project (path, id, name, registered_at, unavailable, manifest_digest)
    values (?, ?, ?, ?, ?, ?)
    on conflict(path) do update set
      id = excluded.id, name = excluded.name, registered_at = excluded.registered_at,
      unavailable = excluded.unavailable, manifest_digest = excluded.manifest_digest
  `);

  return {
    projects: () => selectAll.all().map(toProject),
    project: (path) => {
      const row = selectOne.get(path);
      return row ? toProject(row) : null;
    },
    putProject: (row) => {
      upsert.run(row.path, row.id, row.name, row.registeredAt, row.unavailable, row.manifestDigest);
    },
    dropProjectsExcept: (paths) => {
      const placeholders = paths.map(() => '?').join(', ');
      const sql = paths.length
        ? `delete from project where path not in (${placeholders})`
        : 'delete from project';
      db.prepare(sql).run(...paths);
    },
    appendEvent,
    /**
     * Newest first, with the row id as the tiebreaker: two events in the same
     * millisecond still come back in the order they happened.
     */
    events: (filter = {}) => {
      const where: string[] = [];
      const values: (string | number)[] = [];
      if (filter.path !== undefined) {
        where.push('project_path = ?');
        values.push(filter.path);
      }
      if (filter.since !== undefined) {
        where.push('occurred_at >= ?');
        values.push(filter.since);
      }
      if (filter.until !== undefined) {
        where.push('occurred_at <= ?');
        values.push(filter.until);
      }
      const limit = filter.limit ?? EVENT_LIMIT_DEFAULT;
      const sql = `select id, type, project_path, occurred_at, payload, provenance from event
        ${where.length ? `where ${where.join(' and ')}` : ''}
        order by occurred_at desc, id desc limit ?`;
      return db
        .prepare(sql)
        .all(...values, limit)
        .map(toEvent);
    },
    /** The last recorded event of one of `types` for a project, in the order events were appended. */
    latestEvent: (projectPath, types) => {
      const row = db
        .prepare(`select id, type, project_path, occurred_at, payload, provenance from event
          where project_path = ? and type in (${types.map(() => '?').join(', ')}) order by id desc limit 1`)
        .get(projectPath, ...types);
      return row ? toEvent(row) : null;
    },
    cursor: (path) => {
      const row = selectCursor.get(path);
      return row
        ? { path: String(row.path), size: Number(row.size), offset: Number(row.offset), line: Number(row.line), windowDays: row.window_days === 'all' ? 'all' : Number(row.window_days) }
        : null;
    },
    forgetCursors: (prefix) => {
      deleteCursors.run(prefix);
    },
    ingest: (cursor, records, markers = [], limits = []) => {
      const now = new Date().toISOString();
      transaction(() => {
        for (const { record, projectPath, sourceRef } of records) insertRecordRow(record, projectPath, sourceRef, now, 'artifact');
        for (const { marker, projectPath, sourceRef } of markers) {
          const { harness, naturalKey, sessionId, subagentId, timestamp, cwd, trigger, provenance } = marker;
          insertMarker.run(harness, naturalKey, projectPath, sessionId, subagentId, sourceRef, timestamp, cwd, trigger, provenance);
        }
        for (const { limit, projectPath, sourceRef } of limits) {
          insertLimit.run(limit.harness, limit.naturalKey, projectPath, limit.sessionId, limit.subagentId, sourceRef, limit.timestamp, limit.cwd, limit.limit, limit.provenance);
        }
        upsertCursor.run(cursor.path, cursor.size, cursor.offset, cursor.line, cursor.windowDays);
      });
    },
    usage: (projectPath, since) =>
      selectUsage.all(projectPath, since).map((row) => ({
        harness: String(row.harness) as Harness,
        naturalKey: String(row.natural_key),
        requestId: stringOrNull(row.request_id),
        sessionId: String(row.session_id),
        subagentId: stringOrNull(row.subagent_id),
        parentSession: stringOrNull(row.parent_session),
        timestamp: String(row.timestamp),
        cwd: String(row.cwd),
        branch: row.branch === null ? null : { name: String(row.branch), source: String(row.branch_source) as 'harness' | 'reflog' },
        provider: stringOrNull(row.provider),
        model: stringOrNull(row.model),
        provenance: String(row.provenance) as Provenance,
        tokens: tokensOf(row),
      })),
    compactions: (projectPath) =>
      selectMarkers.all(projectPath).map((row) => ({
        harness: String(row.harness) as Harness,
        naturalKey: String(row.natural_key),
        sessionId: String(row.session_id),
        subagentId: stringOrNull(row.subagent_id),
        timestamp: String(row.timestamp),
        cwd: String(row.cwd),
        trigger: stringOrNull(row.trigger),
        provenance: String(row.provenance) as Provenance,
      })),
    usageLimits: (projectPath, since) =>
      selectLimits.all(projectPath, since).map((row) => ({
        harness: String(row.harness) as Harness,
        naturalKey: String(row.natural_key),
        sessionId: String(row.session_id),
        subagentId: stringOrNull(row.subagent_id),
        timestamp: String(row.timestamp),
        cwd: String(row.cwd),
        limit: stringOrNull(row.limit_type),
        provenance: String(row.provenance) as Provenance,
      })),
    usageCounts: (projectPath, harness, liveSince) => {
      const row = countUsage.get(liveSince, projectPath, harness)!;
      const waiting = countUnattributed.get(harness, liveSince)!;
      return { records: Number(row.records), withTokens: Number(row.with_tokens), live: Number(row.live) + Number(waiting.live) };
    },
    receive: (records) => {
      const now = new Date().toISOString();
      transaction(() => {
        for (const record of records) {
          const { input, cachedInput, cacheCreation, output, reasoning } = record.tokens;
          insertUnattributed.run(
            record.harness, record.naturalKey, record.sessionId, record.requestId, record.timestamp, record.provider, record.model,
            input, cachedInput, cacheCreation, output, reasoning, record.provenance, now,
          );
        }
      });
    },
    unattributed: (harness, sessionId) =>
      selectUnattributed.all(harness, sessionId).map((row) => ({
        record: {
          harness: String(row.harness) as Harness,
          naturalKey: String(row.natural_key),
          requestId: stringOrNull(row.request_id),
          sessionId: String(row.session_id),
          subagentId: null,
          parentSession: null,
          timestamp: String(row.timestamp),
          provider: stringOrNull(row.provider),
          model: stringOrNull(row.model),
          provenance: String(row.provenance) as Provenance,
          tokens: tokensOf(row),
        },
        receivedAt: String(row.received_at),
      })),
    sessionPlace: (harness, sessionId, timestamp) => {
      const row = selectPlace.get(harness, sessionId, timestamp);
      return row ? { cwd: String(row.cwd), projectPath: String(row.project_path) } : null;
    },
    attribute: (record, projectPath, receivedAt) => {
      transaction(() => {
        insertRecordRow(record, projectPath, 'opentelemetry', receivedAt, 'opentelemetry');
        deleteUnattributed.run(record.harness, record.naturalKey);
      });
    },
    close: () => db.close(),
  };
}

const numberOrNull = (value: unknown): number | null => (value === null ? null : Number(value));
const tokensOf = (row: Record<string, unknown>): Record<TokenField, number | null> => ({
  input: numberOrNull(row.input),
  cachedInput: numberOrNull(row.cached_input),
  cacheCreation: numberOrNull(row.cache_creation),
  output: numberOrNull(row.output),
  reasoning: numberOrNull(row.reasoning),
});
const stringOrNull = (value: unknown): string | null => (value === null ? null : String(value));

function toEvent(row: Record<string, unknown>): EventRow {
  return {
    id: Number(row.id),
    type: String(row.type),
    projectPath: row.project_path === null ? null : String(row.project_path),
    occurredAt: String(row.occurred_at),
    payload: JSON.parse(String(row.payload)) as Record<string, unknown>,
    provenance: String(row.provenance) as Provenance,
  };
}

function toProject(row: Record<string, unknown>): ProjectRow {
  return {
    path: String(row.path),
    id: row.id === null ? null : String(row.id),
    name: row.name === null ? null : String(row.name),
    registeredAt: String(row.registered_at),
    unavailable: row.unavailable === null ? null : String(row.unavailable),
    manifestDigest: row.manifest_digest === null ? null : String(row.manifest_digest),
  };
}
