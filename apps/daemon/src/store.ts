import { chmodSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { OWNER_ONLY_FILE, storePath } from './home.ts';

/**
 * The machine-level store: one database per Binnacle home (ADR-0015).
 *
 * Two tiers live here. `project` is a **projection**, derived from the registry file
 * and each repository's manifest, and it is rebuilt rather than migrated. The
 * append-only tier — events, and later the ingested harness records — is migrated and
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
};

/** ADR-0007: a record says where it came from, and nothing is ever invented to fill a gap. */
export type Provenance = 'measured' | 'provider_reported' | 'calculated' | 'estimated';

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

export const EVENT_LIMIT_DEFAULT = 50;
export const EVENT_LIMIT_MAX = 500;

export type Store = {
  projects(): ProjectRow[];
  project(path: string): ProjectRow | null;
  putProject(row: ProjectRow): void;
  dropProjectsExcept(paths: string[]): void;
  appendEvent(event: NewEvent): void;
  events(filter?: EventFilter): EventRow[];
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
  db.exec('pragma foreign_keys = on');
  db.exec(`
    create table if not exists meta (
      key text primary key,
      value text not null
    );
    create table if not exists project (
      path text primary key,
      id text,
      name text,
      registered_at text not null,
      unavailable text
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
  `);
  // `or ignore`, not `or replace`: the stored version is what a later Binnacle compares
  // against to decide whether to rebuild the projections (ADR-0015). Overwriting it on
  // every open would destroy the one fact that decision needs.
  db.prepare('insert or ignore into meta (key, value) values (?, ?)').run('schema_version', String(SCHEMA_VERSION));

  const selectAll = db.prepare('select path, id, name, registered_at, unavailable from project order by id');
  const selectOne = db.prepare('select path, id, name, registered_at, unavailable from project where path = ?');
  const upsert = db.prepare(`
    insert into project (path, id, name, registered_at, unavailable)
    values (?, ?, ?, ?, ?)
    on conflict(path) do update set
      id = excluded.id, name = excluded.name,
      registered_at = excluded.registered_at, unavailable = excluded.unavailable
  `);

  const insertEvent = db.prepare(
    'insert into event (type, project_path, occurred_at, payload, provenance) values (?, ?, ?, ?, ?)',
  );

  return {
    projects: () => selectAll.all().map(toProject),
    project: (path) => {
      const row = selectOne.get(path);
      return row ? toProject(row) : null;
    },
    putProject: (row) => {
      upsert.run(row.path, row.id, row.name, row.registeredAt, row.unavailable);
    },
    dropProjectsExcept: (paths) => {
      const placeholders = paths.map(() => '?').join(', ');
      const sql = paths.length
        ? `delete from project where path not in (${placeholders})`
        : 'delete from project';
      db.prepare(sql).run(...paths);
    },
    appendEvent: (event) => {
      insertEvent.run(
        event.type,
        event.projectPath ?? null,
        new Date().toISOString(),
        JSON.stringify(event.payload ?? {}),
        event.provenance ?? 'measured',
      );
    },
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
      const limit = Math.min(filter.limit ?? EVENT_LIMIT_DEFAULT, EVENT_LIMIT_MAX);
      const sql = `select id, type, project_path, occurred_at, payload, provenance from event
        ${where.length ? `where ${where.join(' and ')}` : ''}
        order by occurred_at desc, id desc limit ?`;
      return db
        .prepare(sql)
        .all(...values, limit)
        .map(toEvent);
    },
    close: () => db.close(),
  };
}

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
  };
}
