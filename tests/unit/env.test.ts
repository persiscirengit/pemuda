import { describe, expect, it } from "vitest";
import { z } from "zod";
import { clientSchema, serverSchema } from "@/env";

describe("Environment Schema Validation", () => {
  const validServerEnv = {
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/pemuda_dev",
    BETTER_AUTH_SECRET: "super-secure-secret-key-at-least-16-chars",
    BETTER_AUTH_URL: "http://localhost:3000",
    STORAGE_DRIVER: "local" as const,
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_BUCKET: "pemuda-bucket",
    S3_ACCESS_KEY_ID: "minio-access-key",
    S3_SECRET_ACCESS_KEY: "minio-secret-key",
    VAPID_PUBLIC_KEY: "public-vapid-key",
    VAPID_PRIVATE_KEY: "private-vapid-key",
    VAPID_SUBJECT: "mailto:admin@pemuda.local",
    CRON_SECRET: "cron-secret-key-at-least-16-chars",
    BOOTSTRAP_ADMIN_EMAIL: "admin@pemuda.local",
    BOOTSTRAP_ADMIN_PASSWORD: "admin-password-123",
  };

  const validClientEnv = {
    NEXT_PUBLIC_STORAGE_BASE_URL: "http://localhost:3000/uploads",
  };

  it("valid environment objects parse successfully", () => {
    const serverResult = z.object(serverSchema).safeParse(validServerEnv);
    expect(serverResult.success).toBe(true);

    const clientResult = z.object(clientSchema).safeParse(validClientEnv);
    expect(clientResult.success).toBe(true);
  });

  it("applies defaults for optional server and client fields", () => {
    const minimalServerEnv = {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/pemuda_dev",
      BETTER_AUTH_SECRET: "super-secure-secret-key-at-least-16-chars",
      CRON_SECRET: "cron-secret-key-at-least-16-chars",
      BOOTSTRAP_ADMIN_EMAIL: "admin@pemuda.local",
      BOOTSTRAP_ADMIN_PASSWORD: "admin-password-123",
    };

    const serverResult = z.object(serverSchema).parse(minimalServerEnv);
    expect(serverResult.BETTER_AUTH_URL).toBe("http://localhost:3000");
    expect(serverResult.STORAGE_DRIVER).toBe("local");
    expect(serverResult.S3_REGION).toBe("us-east-1");

    const clientResult = z.object(clientSchema).parse({});
    expect(clientResult.NEXT_PUBLIC_STORAGE_BASE_URL).toBe(
      "http://localhost:3000/uploads",
    );
  });

  it("missing required server variable DATABASE_URL throws descriptive Zod error", () => {
    const invalidEnv = { ...validServerEnv, DATABASE_URL: undefined };
    const result = z.object(serverSchema).safeParse(invalidEnv);

    expect(result.success).toBe(false);
    if (!result.success) {
      const dbUrlError = result.error.issues.find((i) =>
        i.path.includes("DATABASE_URL"),
      );
      expect(dbUrlError).toBeDefined();
    }
  });

  it("missing required server variable CRON_SECRET throws descriptive Zod error", () => {
    const invalidEnv = { ...validServerEnv, CRON_SECRET: undefined };
    const result = z.object(serverSchema).safeParse(invalidEnv);

    expect(result.success).toBe(false);
    if (!result.success) {
      const cronError = result.error.issues.find((i) =>
        i.path.includes("CRON_SECRET"),
      );
      expect(cronError).toBeDefined();
    }
  });

  it("rejects BETTER_AUTH_SECRET shorter than 16 characters", () => {
    const invalidEnv = {
      ...validServerEnv,
      BETTER_AUTH_SECRET: "short",
    };
    const result = z.object(serverSchema).safeParse(invalidEnv);
    expect(result.success).toBe(false);
  });

  it("rejects BOOTSTRAP_ADMIN_PASSWORD shorter than 8 characters", () => {
    const invalidEnv = {
      ...validServerEnv,
      BOOTSTRAP_ADMIN_PASSWORD: "short",
    };
    const result = z.object(serverSchema).safeParse(invalidEnv);
    expect(result.success).toBe(false);
  });

  it("rejects invalid email for BOOTSTRAP_ADMIN_EMAIL", () => {
    const invalidEnv = {
      ...validServerEnv,
      BOOTSTRAP_ADMIN_EMAIL: "not-an-email",
    };
    const result = z.object(serverSchema).safeParse(invalidEnv);
    expect(result.success).toBe(false);
  });
});
