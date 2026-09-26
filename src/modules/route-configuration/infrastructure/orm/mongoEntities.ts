import { EntitySchema } from "typeorm";
import type { ObjectId } from "mongodb";
import type { RouteRevision } from "../../domain/types";

export type MongoHead = { _id: string; revision: string; version: number };
export type MongoSnapshot = RouteRevision & {
  _id?: ObjectId;
  configKey: string;
};
export type MongoSchema = { _id: string; version: number; checksum: string };
export type MongoImport = {
  _id?: ObjectId;
  configKey: string;
  importId: string;
};

// Preserve existing document names and IDs; no decorator metadata is required by Next.js.
export const mongoEntities = [
  new EntitySchema<MongoHead>({
    name: "route_heads",
    tableName: "route_heads",
    columns: {
      _id: { type: String, objectId: true, primary: true },
      revision: { type: String },
      version: { type: Number },
    },
  }),
  new EntitySchema<MongoSnapshot>({
    name: "route_revisions",
    tableName: "route_revisions",
    columns: {
      _id: { type: String, objectId: true, primary: true },
      configKey: { type: String },
      revision: { type: String },
      version: { type: Number },
      routes: { type: "array" },
      updatedAt: { type: String },
      checksum: { type: String },
      restoredFrom: { type: String, nullable: true },
      legacyRevision: { type: String, nullable: true },
    },
  }),
  new EntitySchema<MongoSchema>({
    name: "route_storage_schema",
    tableName: "route_storage_schema",
    columns: {
      _id: { type: String, objectId: true, primary: true },
      version: { type: Number },
      checksum: { type: String },
    },
  }),
  new EntitySchema<MongoImport>({
    name: "route_imports",
    tableName: "route_imports",
    columns: {
      _id: { type: String, objectId: true, primary: true },
      configKey: { type: String },
      importId: { type: String },
    },
  }),
];
