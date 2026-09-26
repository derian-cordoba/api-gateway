# Database-backed route storage

The gateway and Dashboard support `sqlite`, `postgres`, and `mongodb` through the
same `RouteStorageManager`. The manager selects the adapter, reuses connections,
checks the schema, and creates application services. It never falls back to another
database or profile after an error. `local-json` remains the default compatibility
mode until you explicitly select a database.

## SQLite: first-time setup

Use the same Node version for installation, the gateway, and Dashboard: SQLite has
a native binding. `pnpm install` is configured to allow its build script. After
changing Node versions, run `pnpm rebuild better-sqlite3`. Node versions without a
prebuilt binary require a working C/C++ build toolchain.

Set these variables in the root `.env` **and** Dashboard's `.env.local` (or inject
them into both processes through your deployment):

```dotenv
ROUTE_STORAGE_DRIVER=sqlite
ROUTE_SQLITE_PATH=/absolute/path/to/data/routes.sqlite
ROUTE_CONFIGURATION_KEY=default
ROUTE_HISTORY_LIMIT=50
ROUTE_STORAGE_POLL_INTERVAL_MS=2000
```

The path must be absolute, because the two applications start in different working
directories. SQLite has no development/production database profile. Both applications
must share the same persistent local file; use a remote driver for separate hosts.

From the repository root, after backing up existing files and pausing Dashboard writes:

```sh
pnpm routes:db:migrate
pnpm routes:db:import-json --file routes.json --dry-run
pnpm routes:db:import-json --file routes.json
pnpm routes:db:status
pnpm dev:all
```

The importer reads `<file>.history` automatically; `--history <directory>` overrides
that location. It validates every imported snapshot, retains the legacy revision ID
as metadata, and preserves all history during import. Source files remain untouched.
File timestamps determine legacy history order; ties are ordered by legacy revision.
The current JSON file determines the current head independently of those timestamps.
Repeated imports with the same receipt do nothing, including after subsequent edits.
Importing different data over an initialized configuration is rejected.

For a new installation with no routes file, initialize deliberately:

```sh
pnpm routes:db:import-json --empty
```

An empty database is **not** automatically treated as an empty configuration. Startup
requires a migrated schema and an initialized configuration key. A dry-run does not
connect to or modify the database. Commands compile the backend before executing;
deployed installations can invoke `node dist/src/modules/route-configuration/cli/index.js`
with the same subcommands directly.

## PostgreSQL

```dotenv
ROUTE_STORAGE_DRIVER=postgres
ROUTE_DATABASE_ENV=development
ROUTE_CONFIGURATION_KEY=default
ROUTE_DATABASE_POOL_SIZE=5
ROUTE_POSTGRES_DEVELOPMENT_URL=postgresql://gateway:password@localhost:5432/gateway_dev
# Supply this only in the production deployment:
# ROUTE_POSTGRES_PRODUCTION_URL=postgresql://gateway:password@db:5432/gateway_prod?sslmode=verify-full
```

Set `ROUTE_DATABASE_ENV=production` to select the production URL. The selector is
independent of `NODE_ENV`, so a local Next.js production build cannot select the
production database accidentally. Only the active profile's credentials are required.
Use separate databases and credentials for development and production. Configure TLS
and certificates through the PostgreSQL driver connection URL/settings supported by
your deployment; certificate verification should remain enabled.

Create the database through your normal provisioning process, then run the same
migrate/import/status commands. SQL snapshots use JSONB. Bounded pools and transactions
protect current state and history. A database-wide advisory transaction lock serializes
these infrequent configuration writes, including concurrent migration/bootstrap calls.

## MongoDB

```dotenv
ROUTE_STORAGE_DRIVER=mongodb
ROUTE_DATABASE_ENV=development
ROUTE_CONFIGURATION_KEY=default
ROUTE_DATABASE_POOL_SIZE=5
ROUTE_MONGODB_DEVELOPMENT_URI=mongodb://localhost:27017/?replicaSet=rs0
ROUTE_MONGODB_DEVELOPMENT_DATABASE=gateway_dev
# Production deployment only:
# ROUTE_MONGODB_PRODUCTION_URI=mongodb+srv://gateway:password@cluster.example/
# ROUTE_MONGODB_PRODUCTION_DATABASE=gateway_prod
```

MongoDB requires a replica set or sharded deployment because current-head changes,
revision insertion, and retention run in one transaction. A standalone MongoDB server
is rejected with a configuration error. Configure TLS, authentication, and replica-set
options in the selected URI. Migrations create indexes before publishing their schema
version. Transactions use snapshot reads and majority write concern; transient
transaction retries are bounded by the driver's transaction deadline.

## Revision behavior and gateway synchronization

- `expectedRevision` is required for database saves and restores. Missing preconditions
  return HTTP 428; stale preconditions return 409; unknown restore revisions return 404.
- Every successful commit gets a new opaque revision ID and increasing version.
  Restoring creates a new revision instead of moving the head backward.
- The default retention is 50 historical revisions plus the current revision. Imports
  preserve all history; the next normal save applies the configured retention limit.
- A save becomes visible to other processes after commit. The gateway polls the head
  every two seconds by default and rebuilds routes only when the revision changes.
- Reloads are serialized. Startup fails if storage cannot load a valid configuration.
  Later failures retain the last valid routes and report `configurationSync.status`
  as `degraded` through the management overview API. Synchronization recovers on later
  polls. SIGHUP still triggers an explicit reload.
- Environment-defined `ROUTES` entries are still composed with stored routes. They
  are outside Dashboard persistence and do not appear in revision snapshots.
- Driver credentials remain server-side. Status responses show driver, profile, and
  configuration key, without connection strings. Observatory uses the gateway API.

## Export, rollback, and migrations

```sh
pnpm routes:db:export-json --out routes-export.json
```

Export writes only the current route snapshot, with restricted file permissions, and
refuses to overwrite a file. Use a database-native backup to preserve full revision
history. Dashboard's existing JSON download continues to work in database mode.

Schema changes are explicit deployment operations. Startup checks compatibility and
does not automatically apply migrations. The initial SQL migration and its checksum
are shared by SQLite/PostgreSQL with dialect-specific payload types. MongoDB owns its
collection/index migration. Future schema versions require corresponding versioned
migrations; unknown schema versions and mismatched stored checksums are rejected.

To roll back to JSON after database edits: pause writes, export the latest state,
configure both applications with `ROUTE_STORAGE_DRIVER=local-json` and the exported
`ROUTES_FILE_PATH`, then restart. The old source files do not contain new database edits.
To change database drivers, export/import the current routes into a fresh destination;
this is not a cross-driver history transfer. Keep the source database backup for history.

## Code organization and lifecycle

`src/modules/route-configuration` contains domain types/validation, an application
service, the storage manager, and TypeORM infrastructure adapters. `createRouteDataSource`
centralizes all connection options and entity registration. SQLite and PostgreSQL share
entity schemas, repository operations, and a SQL unit of work. Schema creation uses
TypeORM's `QueryRunner`/`Table` APIs; synchronization and startup migrations are disabled.
Existing version-one tables, documents, checksums, and revisions remain compatible.

MongoDB uses TypeORM's `MongoRepository` for document and index operations. TypeORM's
MongoDB transaction methods are no-ops, so `MongoUnitOfWork` creates real sessions from
the ORM-owned client and forwards them to every operation in a transaction. This is
the only native-driver bridge; connection lifecycle remains owned by the DataSource.
SQL locking stays in `SqlUnitOfWork`: PostgreSQL uses an advisory transaction lock and
SQLite reserves a write lock before reading. SQL reads use a consistent transaction
snapshot. No database-specific API leaks into the application service or domain.
The old gateway schema import paths re-export the shared schemas for compatibility.

The gateway owns its default manager and closes it at shutdown. A manager supplied
through `GatewayRuntimeOptions.routeStorageManager` remains owned by its caller.
Dashboard retains one server-side manager across development module reloads; call
`close()` when embedding it in a custom server. Do not create a connection per request.
Native and remote driver dependencies load only when their adapter is constructed.

## Optional local database containers

```sh
docker compose -f examples/database-storage/compose.yaml up -d
```

This development-only setup exposes PostgreSQL on `localhost:15432` (database
`gateway_dev`, user `gateway`, password `local-development-only`) and a MongoDB
replica set on `localhost:27018`. Use `mongodb://localhost:27018/?replicaSet=rs0`.
Ports bind to loopback. Named volumes preserve data between restarts; these settings
are not production credentials or a production deployment template.

## Tests

```sh
pnpm test:storage
TEST_POSTGRES_URL=postgresql://route_test@localhost:5432/dedicated_test_db pnpm test:storage
pnpm test:storage:mongodb
pnpm test:dashboard
pnpm test
```

Use a dedicated test database. Remote contract tests use isolated configuration keys
but do not erase the supplied database. PostgreSQL tests are skipped unless
`TEST_POSTGRES_URL` is set. MongoDB tests can use `TEST_MONGODB_URI`, or the MongoDB test
runner downloads a test binary, starts a temporary single-member replica set, runs the
suite, and stops it. Set `TEST_POSTGRES_URL` while using that runner to test all drivers
in one invocation. SQLite tests always run with temporary files.

## Dashboard source selection

See [Dashboard route sources](dashboard-route-sources.md) to configure multiple named
sources, edit their routes independently, and activate a source through the gateway.
