import { defineConfig } from "drizzle-kit";
import { env } from "./src/env";

export default defineConfig({
  schema: "./src/db/schema/auth.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/pemuda_dev",
  },
});
