import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import * as schema from "./schema";

const client = postgres(
  env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/pemuda_dev",
);
export const db = drizzle(client, { schema });
