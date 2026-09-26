# Manage route sources from the Dashboard

Settings → **Route sources** lists deployment-configured sources. Selecting a source
changes what the Dashboard edits; **Activate source…** changes gateway traffic.
Routes, history, restores, status, and exports follow the selected source. The editor
shows its source name and environment. Selection is local to the current page session;
a full page reload selects `default`. The gateway's active selection is persisted
independently and survives restarts.

## Choose a storage driver dynamically

The **Route storage driver** selector offers **Legacy — JSON file**, **Database —
SQLite**, **Database — PostgreSQL**, and **Database — MongoDB**. The **Source to edit**
selector shows only connections for that driver, including development and production
connections when configured. Selecting a driver loads its routes into the Dashboard;
**Check source** and **Activate source…** apply it to gateway traffic without a restart.
Selecting a driver does not copy routes from the previous driver.

The registry automatically discovers connections from these existing server settings:

| Driver | Connection settings |
| --- | --- |
| Legacy JSON | `ROUTES_FILE_PATH` (or the existing default file path) |
| SQLite | `ROUTE_SQLITE_PATH` |
| PostgreSQL | `ROUTE_POSTGRES_DEVELOPMENT_URL`, `ROUTE_POSTGRES_PRODUCTION_URL` |
| MongoDB | `ROUTE_MONGODB_DEVELOPMENT_URI` + `ROUTE_MONGODB_DEVELOPMENT_DATABASE`, and/or their `PRODUCTION` counterparts |

Configure the same connections on the Dashboard and gateway. You no longer need to
create `ROUTE_SOURCE_PROFILES` merely to switch between these standard drivers. An
unconfigured driver stays visible but disabled. Credentials remain server-side.
Remote environments are discovered independently; switching to a remote driver prefers
its development connection when available. SQLite and JSON have no environment selector.

The existing deployment driver retains the `default` ID. Other discovered connections
use `storage-json`, `storage-sqlite`, `storage-postgres-development`,
`storage-postgres-production`, `storage-mongodb-development`, and
`storage-mongodb-production`. These IDs are reserved. Named profiles remain available
for additional databases or configuration keys. Configure the control database below
to enable live activation; initialize database schemas and route snapshots before use.

## Configure profiles

Set the same `ROUTE_SOURCE_PROFILES` and referenced connection variables on the
gateway and Dashboard servers. The reserved `default` profile uses the existing
`ROUTE_STORAGE_DRIVER`, database environment, configuration key, and routes file
settings. Existing deployments without profiles/control settings keep their original
reload behavior. Use absolute local file paths in both processes.

For example, add a second SQLite source:

```dotenv
ROUTE_SOURCE_PROFILES='[{"id":"preview","name":"Preview routes","driver":"sqlite","connectionEnv":"PREVIEW_SQLITE_PATH","configurationKey":"preview"}]'
PREVIEW_SQLITE_PATH=/absolute/path/to/data/preview.sqlite
```

Create its schema and initialize its configuration explicitly before activating:

```sh
ROUTE_STORAGE_DRIVER=sqlite ROUTE_SQLITE_PATH=/absolute/path/to/data/preview.sqlite ROUTE_CONFIGURATION_KEY=preview pnpm routes:db:migrate
ROUTE_STORAGE_DRIVER=sqlite ROUTE_SQLITE_PATH=/absolute/path/to/data/preview.sqlite ROUTE_CONFIGURATION_KEY=preview pnpm routes:db:import-json --empty
```

Profiles reference environment variable **names**, never credentials supplied by a
browser. A PostgreSQL profile looks like:

```json
{
  "id": "production",
  "name": "Production routes",
  "driver": "postgres",
  "environment": "production",
  "configurationKey": "default",
  "connectionEnv": "PRODUCTION_ROUTES_URL"
}
```

For MongoDB, use `driver: "mongodb"`, reference the URI using `connectionEnv`, and
reference the database name using `databaseEnv`. Both remote drivers require an explicit
`development` or `production` environment. SQLite and `local-json` profiles cannot have
an environment; `connectionEnv` references their absolute file path. MongoDB still
requires a replica set or sharded cluster. Local JSON keeps its existing process-local
write locking; use database storage for multiple Dashboard writers.

Source IDs must be unique lowercase identifiers, and `default` cannot be redefined.
Profiles are deployment configuration: restart affected processes after changing them.
The UI does not edit `.env` files, create connections from arbitrary URLs, automatically
migrate a source, initialize an empty database, or copy data when activating.

## Enable gateway activation

On the gateway, configure exactly one stable control database:

```dotenv
# One host: create the parent directory first.
ROUTE_CONTROL_SQLITE_PATH=/absolute/path/to/data/source-control.sqlite
# Multiple hosts: use one shared PostgreSQL control database instead.
# ROUTE_CONTROL_POSTGRES_URL=postgresql://gateway:password@host/gateway_control
GATEWAY_INSTANCE_ID=gateway-local
MANAGEMENT_ENABLED=true
MANAGEMENT_TOKEN=your-management-token
```

The control database contains only the desired source ID and activation version. Its
small control table is initialized on first connection, independently of route schemas.
The location must remain stable when activating another source. A shared PostgreSQL
control database coordinates instances on different hosts; SQLite requires a shared
local file on one host. Without a control database, profiles remain editable but live
activation is disabled. Programmatically injected route sources/storage managers keep
their caller-owned lifecycle and do not enable managed activation.

On the Dashboard server:

```dotenv
GATEWAY_MANAGEMENT_URL=http://localhost:3000/management
GATEWAY_MANAGEMENT_TOKEN=your-management-token
```

Use the gateway's configured management prefix in that URL. The token stays server-side.
Existing Dashboard authentication protects source endpoints. Gateway source endpoints
use management authentication; treat that token as administrative because it can now
activate sources in managed deployments. No production source is activated by setup.

## Activation and recovery

1. Select the source and run **Check source**. The check loads and validates a snapshot
   and reports its revision and route count.
2. Choose **Activate source…** and review the destination/environment and revision.
3. The gateway verifies the revision and activation version, builds the candidate router,
   and persists the selection with a compare-and-set update before applying the router.
4. A failed build or conflicting activation leaves that instance's current router intact.
   Other instances poll the shared selection and source snapshots every two seconds.

The UI distinguishes desired and applied selections for the **responding gateway
instance**. It is not a fleet-wide acknowledgement. Use instance-specific management
URLs when verifying each instance. Instances with unavailable sources retain their
last valid routes and report degraded synchronization. They retry automatically.
A restarting instance loads the persisted desired source and fails startup if it cannot
load it; it does not silently fall back to a different source. The persistence-before-
apply ordering allows a process crash between those steps to recover on restart.

Ordinary edits to the active source continue to propagate. Environment-defined `ROUTES`
remain composed with the selected snapshot. Switch back by activating the previous
source with the latest activation version. Neither activation nor rollback copies data.
History belongs to each source independently.

## API and implementation

- `GET /api/route-sources`: safe profile summaries and responding gateway status.
- `POST /api/route-sources/:id/check`: validate the source without migrating it.
- `GET|PUT /api/route-sources/:id/config`: source-specific configuration access.
- `GET|POST /api/route-sources/:id/history`: source-specific history and restore.
- `POST /api/route-sources/:id/activate`: `{ expectedVersion, expectedRevision }`.
- Existing `/api/config`, `/api/config/history`, `/api/config/export`, and `/api/status`
  accept `?source=<id>`; omitting it preserves the default-source behavior.
- Gateway: `GET /management/v1/route-sources` and
  `POST /management/v1/route-sources/:id/activate` (prefix configurable).

`src/modules/route-sources` owns profile resolution, database manager reuse, validated
snapshots, and TypeORM control storage. `ManagedRouteReloader` owns preparation,
activation serialization, router lifecycle, polling, and per-instance status. Dashboard
services, hooks, and small components handle transport, state, health, and confirmation.

Configuration requests carry explicit source identity. Late reads from a previous
selection are ignored, source changes reset configuration/status/history state, and
switching is disabled while a save or restore is in progress. Revision preconditions
prevent stale writes. Drafts prompt before link navigation or leaving the browser page;
source selection never migrates a draft into another source.
