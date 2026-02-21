// This file is a stub — it will be overwritten by `npx convex dev`.
// It exists so that convex-test can locate the _generated directory
// for running integration tests without a live Convex connection.
import type { DataModelFromSchemaDefinition } from "convex/server";
import schema from "../schema";
export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
