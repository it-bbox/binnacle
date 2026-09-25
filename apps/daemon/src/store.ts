import { chmodSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { ImportWindow } from '@binnacle/core';
import type { Harness, Provenance, TokenField, UsageRecord } from '@binnacle/telemetry';
import { OWNER_ONLY_FILE, storePath } from './home.ts';

/**
 * The machine-level store: one database per Binnacle home (ADR-0015).
 *
 * Two tiers live here. `project` is a **projection**, derived from the registry file
 * and each repository's manifest, and it is rebuilt rather than migrated. The
 * append-only tier — events, and the usage records ingested from harness artifacts with
 * the cursors they were read up to — is migrated and never recreated, because it is the
 * only copy of what was observed.
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

export type StoredUsage = Pick<UsageRecord, 'timestamp' | 'model' | 'tokens' | 'provenance'>;

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
  /** Stores the records a file gave and moves its cursor, together or not at all. A record already stored is left as it was. */
  ingest(cursor: IngestCursor, records: Ingested[]): void;
  /** A project's records of one harness from `since` on, an ISO timestamp. */
  usage(projectPath: string, harness: Harness, since: string): StoredUsage[];
  /** How many of a project's records of one harness there are, and how many report any token count. */
  usageCounts(projectPath: string, harness: Harness): { records: number; withTokens: number };
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
    create table if not exists ingest_cursor (
      path text primary key,
      size integer not null,
      offset integer not null,
      line integer not null,
      window_days integer not null
    );
  `);

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

  // `subagent_id` and `parent_session` stay null until subagents are read.
  const insertRecord = db.prepare(`
    insert into ingested_record (harness, natural_key, project_path, session_id, source_ref, timestamp, cwd, branch, branch_source,
      provider, model, input, cached_input, cache_creation, output, reasoning, provenance, ingested_at)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict (harness, natural_key) do nothing
  `);
  // `window_days` holds `all` as text: SQLite keeps a value its column's type cannot convert as it is.
  const upsertCursor = db.prepare(`
    insert into ingest_cursor (path, size, offset, line, window_days) values (?, ?, ?, ?, ?)
    on conflict (path) do update set size = excluded.size, offset = excluded.offset, line = excluded.line, window_days = excluded.window_days
  `);
  const selectCursor = db.prepare('select path, size, offset, line, window_days from ingest_cursor where path = ?');
  const deleteCursors = db.prepare('delete from ingest_cursor where substr(path, 1, length(?1)) = ?1');
  const selectUsage = db.prepare(`
    select timestamp, model, provenance, input, cached_input, cache_creation, output, reasoning from ingested_record
    where project_path = ? and harness = ? and timestamp >= ?
  `);
  const countUsage = db.prepare(`
    select count(*) as records,
      count(case when coalesce(input, cached_input, cache_creation, output, reasoning) is not null then 1 end) as with_tokens
    from ingested_record where project_path = ? and harness = ?
  `);

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
    ingest: (cursor, records) => {
      const now = new Date().toISOString();
      db.exec('begin immediate');
      try {
        for (const { record, projectPath, sourceRef } of records) {
          const { input, cachedInput, cacheCreation, output, reasoning } = record.tokens;
          insertRecord.run(
            record.harness, record.naturalKey, projectPath, record.sessionId, sourceRef, record.timestamp, record.cwd,
            record.branch?.name ?? null, record.branch?.source ?? null, record.provider, record.model,
            input, cachedInput, cacheCreation, output, reasoning, record.provenance, now,
          );
        }
        upsertCursor.run(cursor.path, cursor.size, cursor.offset, cursor.line, cursor.windowDays);
        db.exec('commit');
      } catch (error) {
        if (db.isTransaction) db.exec('rollback');
        throw error;
      }
    },
    usage: (projectPath, harness, since) =>
      selectUsage.all(projectPath, harness, since).map((row) => ({
        timestamp: String(row.timestamp),
        model: row.model === null ? null : String(row.model),
        provenance: String(row.provenance) as Provenance,
        tokens: {
          input: numberOrNull(row.input),
          cachedInput: numberOrNull(row.cached_input),
          cacheCreation: numberOrNull(row.cache_creation),
          output: numberOrNull(row.output),
          reasoning: numberOrNull(row.reasoning),
        } satisfies Record<TokenField, number | null>,
      })),
    usageCounts: (projectPath, harness) => {
      const row = countUsage.get(projectPath, harness)!;
      return { records: Number(row.records), withTokens: Number(row.with_tokens) };
    },
    close: () => db.close(),
  };
}

const numberOrNull = (value: unknown): number | null => (value === null ? null : Number(value));

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
