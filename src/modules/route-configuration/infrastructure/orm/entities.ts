import { EntitySchema } from "typeorm";
import type { GatewayRoute } from "../../domain/types";

export class RouteHeadEntity {
  configKey!: string;
  revision!: string;
  version!: number;
}

export class RouteRevisionEntity {
  configKey!: string;
  revision!: string;
  version!: number;
  routes!: GatewayRoute[];
  updatedAt!: string;
  checksum!: string;
  restoredFrom!: string | null;
  legacyRevision!: string | null;
}

export class RouteImportEntity {
  configKey!: string;
  importId!: string;
}

export class RouteSchemaEntity {
  id!: number;
  version!: number;
  checksum!: string;
}

export function sqlEntities(postgres: boolean): EntitySchema[] {
  const version = {
    type: "bigint" as const,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  };
  return [
    new EntitySchema<RouteHeadEntity>({
      name: "RouteHead",
      target: RouteHeadEntity,
      tableName: "route_heads",
      columns: {
        configKey: { type: "text", name: "config_key", primary: true },
        revision: { type: "text" },
        version,
      },
    }),
    new EntitySchema<RouteRevisionEntity>({
      name: "RouteRevision",
      target: RouteRevisionEntity,
      tableName: "route_revisions",
      columns: {
        configKey: { type: "text", name: "config_key", primary: true },
        revision: { type: "text", primary: true },
        version,
        routes: { type: postgres ? "jsonb" : "simple-json", name: "payload" },
        updatedAt: { type: "text", name: "updated_at" },
        checksum: { type: "text" },
        restoredFrom: { type: "text", name: "restored_from", nullable: true },
        legacyRevision: {
          type: "text",
          name: "legacy_revision",
          nullable: true,
        },
      },
      uniques: [{ columns: ["configKey", "version"] }],
    }),
    new EntitySchema<RouteImportEntity>({
      name: "RouteImport",
      target: RouteImportEntity,
      tableName: "route_imports",
      columns: {
        configKey: { type: "text", name: "config_key", primary: true },
        importId: { type: "text", name: "import_id", primary: true },
      },
    }),
    new EntitySchema<RouteSchemaEntity>({
      name: "RouteSchema",
      target: RouteSchemaEntity,
      tableName: "route_storage_schema",
      columns: {
        id: { type: "integer", primary: true },
        version: { type: "integer" },
        checksum: { type: "text" },
      },
    }),
  ];
}
