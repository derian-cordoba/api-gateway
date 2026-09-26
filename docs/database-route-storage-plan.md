# Database-backed route configuration — implementation plan

Status: implementation delivered for SQLite, PostgreSQL, and MongoDB. See [the operational guide](database-route-storage.md) for the implemented configuration and commands. Existing application data has not been migrated automatically.

This document records the original design. SQLite and PostgreSQL share the SQL repository with separate connection adapters; legacy JSON remains the compatibility default until explicit cutover.

## Scope and implementation order

Replace the route configuration JSON file and revision directory with interchangeable
database repositories, in this order: **SQLite → PostgreSQL → MongoDB**.

The gateway and Dashboard must use the same selected database and configuration key.
Observatory continues to read the gateway management API; it does not connect directly
to the database. PostgreSQL and MongoDB support explicitly selected development and
production connection profiles. SQLite has one configured path, without those profiles.

## Findings in the current code

- Dashboard's `ConfigurationService` directly constructs `LocalJsonRouteConfigStore`.
- The store validates routes, writes JSON, keeps revision files, and implements an
  optimistic revision check protected only by a process-local write queue.
- Gateway `ProxyManager` constructs a `FileRouteSource` plus an `EnvRouteSource`.
- `RouteReloader` watches the route file's directory and also handles SIGHUP.
- Dashboard contracts expose `filePath`; its status endpoint hard-codes `local-json`.
- Revision identifiers currently derive from content hashes. Restoring identical
  content can reproduce an old identifier, so identifiers cannot reliably represent
  the sequence of configuration changes.

Changing Dashboard storage alone would leave the running gateway on the old file.
Database concurrency, route reload detection, status metadata, and migration therefore
belong to the first SQLite milestone.

## Architecture

Create a shared server-side business module, separate from React and Express:

```text
src/modules/route-configuration/
  domain/
    RouteConfiguration.ts
    RouteRevision.ts
    RouteConfigurationRepository.ts
    ConfigurationConflictError.ts
    validation/
  application/
    RouteConfigurationService.ts
    ImportRouteConfiguration.ts
  infrastructure/
    RouteStorageManager.ts
    config/
      StorageDriver.ts
      DatabaseEnvironment.ts
      storage-config.ts
    sqlite/
      SqliteConnection.ts
      SqliteRouteConfigurationRepository.ts
      migrations/
    postgres/
      PostgresConnection.ts
      PostgresRouteConfigurationRepository.ts
      migrations/
    mongodb/
      MongoConnection.ts
      MongoRouteConfigurationRepository.ts
      migrations/
    legacy/
      JsonConfigurationImporter.ts
```

Dependencies point inward: controllers and route sources call application services;
services depend on repository contracts; database adapters implement those contracts.
Shared validation must not import either application's configuration or logger.
Move the authoritative route schema/types into the shared module as needed, retaining
re-exports from existing paths to avoid unrelated call-site churn.

### Central configuration class

`RouteStorageManager` is the single composition entry point for both applications.
It validates the selected configuration, resolves the driver and environment profile,
lazily loads the selected adapter, initializes its connection, and exposes:

- `getRepository()` — the common repository contract.
- `getStatus()` — sanitized driver/profile/schema-version and connectivity metadata.
- `close()` — idempotent connection/pool shutdown.

Initialization is shared within a process, including concurrent callers; failed
initialization can be retried without leaving an unusable cached promise. Next.js
development reloads must not leak pools. The gateway reuses its repository when
rebuilding routers. Neither app creates a connection per HTTP request.

The manager selects and owns adapters; it does not contain driver queries or business
validation. Use a small driver factory/registry and dependency injection. Each driver
can be tested independently, and only the selected driver's runtime dependency loads.

## Repository contract and revision model

Make read, commit, history, and revision lookup mandatory for every database adapter.
Keep database sessions and SQL/BSON types inside adapters. Application-level restore
validates a historical snapshot and commits it as a new revision.

Persist complete validated route snapshots to preserve atomic configuration replacement
and the existing JSON import/export format. Do not initially normalize every nested
proxy, authentication, and middleware setting into separate tables.

Logical data model:

| Entity | Important fields |
| --- | --- |
| Configuration head | configuration key, current revision ID, version, updated timestamp |
| Immutable revision | revision ID, configuration key, version, routes snapshot, content checksum, created timestamp, restored-from ID |
| Schema migrations | migration ID, checksum, applied timestamp |

Use opaque unique revision IDs and a monotonic version per configuration. Checksums
identify content; they are separate from revision identity. Serialize timestamps as
UTC ISO strings. History ordering uses version, not filename or timestamp alone.

Every save/restore must atomically:

1. Check the expected current revision.
2. Insert the immutable revision.
3. Advance the head and version using a conditional update.
4. Apply retention without deleting the active revision.

The database enforces this across processes. Two writers with the same expected
revision cannot both succeed. Preserve HTTP 409 for conflicts. Require expectedRevision
for normal update/restore APIs; use a separate explicit bootstrap/import operation for
an empty store. This tightens the currently optional precondition and requires updating
API documentation and tests along with the endpoints.

Keep 50 historical revisions by default, configurable independently from the active
revision. Restoring creates a new revision even when its content matches an older one.
Store errors distinguish conflicts, missing revisions, unavailable storage, invalid
configuration, and incompatible schema versions. Wrap original causes with
`withErrorContext`; do not expose database connection strings in API errors.

## Driver and environment configuration

Proposed variables:

```dotenv
ROUTE_STORAGE_DRIVER=sqlite
ROUTE_CONFIGURATION_KEY=default
ROUTE_SQLITE_PATH=/absolute/path/to/routes.sqlite
ROUTE_HISTORY_LIMIT=50
ROUTE_STORAGE_POLL_INTERVAL_MS=2000

# Selected only for PostgreSQL or MongoDB:
ROUTE_DATABASE_ENV=development
ROUTE_POSTGRES_DEVELOPMENT_URL=postgresql://...
ROUTE_POSTGRES_PRODUCTION_URL=postgresql://...
ROUTE_MONGODB_DEVELOPMENT_URI=mongodb://...
ROUTE_MONGODB_PRODUCTION_URI=mongodb://...
```

Represent the validated configuration as a discriminated TypeScript union. SQLite
has a path and no environment field. PostgreSQL/MongoDB have a selected environment
and resolved connection settings. Validate only the selected driver's active profile;
do not require production credentials in development. Include MongoDB database name
and PostgreSQL/MongoDB TLS/pool settings in their driver-specific configuration.

Select the database profile explicitly, independently of NODE_ENV: a local Next.js
production build must not accidentally select a production database. Do not fall back
between environments or drivers when credentials are missing or a connection fails.
Changing configuration takes effect on process restart, not through a public UI switch.

Use server-only environment variables. Both processes must resolve the same absolute
SQLite path despite their different working directories. Remote connection profiles
should point at separate development and production databases. SQLite may still be
used in a deployment; it simply has no development/production connection selector.

## Gateway and Dashboard integration

- Add `DatabaseRouteSource`, injected through gateway runtime composition.
- In database mode, replace the file source; retain existing environment route
  composition and document that those routes remain outside Dashboard persistence.
- Add revision polling shared by all database drivers. Poll only the head/version,
  and load/rebuild routes when it changes. Notifications can be a later optimization.
- Serialize/coalesce reloads so an older asynchronous rebuild cannot replace a newer
  one. Track the revision actually loaded, not just the last revision observed.
- On initial database failure, fail startup/readiness. During a later outage, keep
  serving the last validated configuration and expose degraded synchronization state.
- Stop pollers and close connections during shutdown. Preserve explicit SIGHUP reload.
- Have Dashboard's existing service delegate to the shared application service.
- Replace required filePath fields with storage metadata; retain a deprecated optional
  filePath only where needed for the legacy transition. Show driver/environment and
  revision state without credentials.
- Keep JSON download/import as an interchange format. Database mode must not write
  JSON files as a second source of truth.

## Phase 1 — SQLite and the complete shared integration

Implement contracts, configuration, manager, migrations, repository, importer, API/UI
changes, and gateway database reloads together. Evaluate a SQLite binding compatible
with the project's Node >=20.9 baseline and Next.js server bundling before pinning it;
do not implicitly raise the Node minimum by assuming built-in SQLite availability.

Use transactional writes, WAL, foreign keys, unique constraints, a busy timeout, and
short write transactions. SQLite supports concurrent readers but only one writer;
`BEGIN IMMEDIATE` can acquire the write transaction before the revision check.
See [SQLite transactions](https://www.sqlite.org/lang_transaction.html) and
[WAL documentation](https://www.sqlite.org/wal.html).

SQLite is a local-file deployment: gateway and Dashboard share persistent storage on
the same host. Do not present WAL on a network filesystem as a multi-host solution.

Acceptance: a Dashboard edit persists, reloads the gateway, survives restart, appears
in history, and can be restored; a competing stale writer receives 409.

## Phase 2 — PostgreSQL

Implement the same repository contract using the PostgreSQL driver, a bounded pool,
parameterized statements, transaction-scoped connections, JSONB snapshots, and indexed
history. Use row locking or a conditional head update inside the transaction to enforce
the expected revision. Add driver-specific migrations and explicit dev/prod profiles.

Keep revision polling initially. LISTEN/NOTIFY can later reduce latency, with polling
retained for missed notifications and reconnects. Add local development infrastructure
and CI integration tests without requiring production access.

Acceptance: the common contract suite passes against real PostgreSQL, including
separate-process writers, rollback, reconnects, and environment isolation.

## Phase 3 — MongoDB

Implement configuration-head and immutable-revision collections, indexes, migration
records, and atomic multi-document commits through sessions/transactions. Keep storage
details behind the same contract; do not expose ObjectId in the public revision API.

Require a transaction-capable replica set or sharded deployment. Standalone MongoDB
does not support these transactions; include a development replica-set configuration
and fail with a clear diagnostic when deployment requirements are unmet.
See [MongoDB transaction deployment requirements](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/).

Use bounded driver-supported transaction retries for transient transaction failures,
while distinguishing those from user revision conflicts. Keep revision polling as the
baseline; change streams remain optional future work.

Acceptance: the same storage and integration tests pass against a real replica set,
including transaction failure, conflicting writes, and dev/prod isolation.

## Migration, rollout, and verification

Provide explicit proposed commands: `pnpm routes:db:migrate`, `pnpm routes:db:status`,
`pnpm routes:db:import-json`, and `pnpm routes:db:export-json`. Migrations are versioned,
concurrency-safe, and invoked during deployment; application startup checks compatibility
instead of silently changing production schemas.

The importer supports dry-run, validates the current file and every history snapshot,
preserves legacy revision identifiers as migration metadata, and imports idempotently.
Legacy history timestamps are file metadata, so reconstruct ordering deterministically
and report ambiguity rather than claiming an exact historical sequence. The original
routes file explicitly determines the imported head. Do not prune history during import;
apply configured retention in a separate documented step.

Cutover sequence: back up source files, pause Dashboard writes, migrate schema, import,
verify snapshots/head/history, configure both processes for the database, restart, and
verify a real save/reload/restore cycle. Leave source files untouched. A rollback after
new database writes requires exporting the latest database state before returning to
file mode; the old files are no longer current.

Retain legacy JSON mode only as an explicit compatibility option during transition,
never an automatic database-error fallback. Announce any eventual removal separately.

Run a reusable repository contract suite against each real database. Cover read/write,
cross-process conflicts, transactional rollback, restore identity, retention, pagination,
bootstrap races, invalid data, migration idempotency, and environment selection. Add
gateway tests for failed startup, reload after saves, missed polls, last-known-good
behavior, and overlapping reloads. Run Dashboard API tests, gateway regression tests,
TypeScript/lint checks, and both React production builds for each integration milestone.
