import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { S3Client } from "@aws-sdk/client-s3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createStorageDriver,
  generateStorageKey,
  LocalDriver,
  resolveStorageUrl,
  S3Driver,
  storage,
} from "@/lib/storage";

describe("Storage Abstraction (Dual Driver Local/S3)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pemuda-storage-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("Relative Storage Key Convention", () => {
    it("generates structured relative keys under uploads/ category", () => {
      const memberKey = generateStorageKey("members", "user-uuid-1");
      expect(memberKey).toBe("uploads/members/user-uuid-1.webp");

      const activityKey = generateStorageKey("activities", "act-uuid-2");
      expect(activityKey).toBe("uploads/activities/act-uuid-2.webp");

      const articleKey = generateStorageKey("articles", "art-uuid-3");
      expect(articleKey).toBe("uploads/articles/art-uuid-3.webp");

      const editorKey = generateStorageKey("editor", "edit-uuid-4");
      expect(editorKey).toBe("uploads/editor/edit-uuid-4.webp");

      const systemKey = generateStorageKey("system", "sys-uuid-5");
      expect(systemKey).toBe("uploads/system/sys-uuid-5.webp");
    });

    it("generates automatic UUIDv7 if id is not passed", () => {
      const generated = generateStorageKey("members");
      expect(generated).toMatch(/^uploads\/members\/[0-9a-f-]{36}\.webp$/);
    });

    it("never starts with a slash or scheme protocol", () => {
      const key = generateStorageKey("articles", "id-1");
      expect(key.startsWith("/")).toBe(false);
      expect(key.startsWith("http")).toBe(false);
    });
  });

  describe("LocalDriver", () => {
    it("upload writes file to local filesystem and returns relative key", async () => {
      const driver = new LocalDriver({
        publicDir: tempDir,
        baseUrl: "http://localhost:3000/uploads",
      });

      const key = "uploads/members/test-user.webp";
      const payload = Buffer.from("fake-webp-content");

      const returnedKey = await driver.upload(key, payload, "image/webp");
      expect(returnedKey).toBe(key);

      const savedPath = path.join(tempDir, key);
      expect(fs.existsSync(savedPath)).toBe(true);
      expect(fs.readFileSync(savedPath, "utf-8")).toBe("fake-webp-content");
    });

    it("delete cleanly removes target file from local filesystem", async () => {
      const driver = new LocalDriver({
        publicDir: tempDir,
        baseUrl: "http://localhost:3000/uploads",
      });

      const key = "uploads/activities/banner.webp";
      const savedPath = path.join(tempDir, key);
      fs.mkdirSync(path.dirname(savedPath), { recursive: true });
      fs.writeFileSync(savedPath, "banner-content");

      expect(fs.existsSync(savedPath)).toBe(true);
      await driver.delete(key);
      expect(fs.existsSync(savedPath)).toBe(false);
    });

    it("delete succeeds silently when file does not exist", async () => {
      const driver = new LocalDriver({
        publicDir: tempDir,
        baseUrl: "http://localhost:3000/uploads",
      });

      await expect(
        driver.delete("uploads/nonexistent.webp"),
      ).resolves.toBeUndefined();
    });

    it("getUrl constructs public URL without duplicate uploads segment", () => {
      const driver = new LocalDriver({
        baseUrl: "http://localhost:3000/uploads",
      });

      const url = driver.getUrl("uploads/members/user-1.webp");
      expect(url).toBe("http://localhost:3000/uploads/members/user-1.webp");
    });
  });

  describe("S3Driver", () => {
    it("delegates upload to S3Client with PutObjectCommand and returns relative key", async () => {
      const mockSend = vi.fn().mockResolvedValue({});
      const mockS3Client = { send: mockSend } as unknown;

      const driver = new S3Driver({
        bucket: "pemuda-bucket",
        endpoint: "https://s3.example.com",
        client: mockS3Client as S3Client,
      });

      const key = "uploads/articles/featured.webp";
      const payload = Buffer.from("image-bytes");

      const returnedKey = await driver.upload(key, payload, "image/webp");
      expect(returnedKey).toBe(key);
      expect(mockSend).toHaveBeenCalledTimes(1);

      const commandArg = mockSend.mock.calls[0]?.[0];
      expect(commandArg.input).toMatchObject({
        Bucket: "pemuda-bucket",
        Key: "uploads/articles/featured.webp",
        Body: payload,
        ContentType: "image/webp",
      });
    });

    it("delegates delete to S3Client with DeleteObjectCommand", async () => {
      const mockSend = vi.fn().mockResolvedValue({});
      const mockS3Client = { send: mockSend } as unknown;

      const driver = new S3Driver({
        bucket: "pemuda-bucket",
        client: mockS3Client as S3Client,
      });

      const key = "uploads/system/logo.webp";
      await driver.delete(key);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const commandArg = mockSend.mock.calls[0]?.[0];
      expect(commandArg.input).toMatchObject({
        Bucket: "pemuda-bucket",
        Key: "uploads/system/logo.webp",
      });
    });

    it("getUrl constructs public URL via custom domain or endpoint", () => {
      const customDomainDriver = new S3Driver({
        bucket: "pemuda-bucket",
        publicBaseUrl: "https://assets.pemudacirengit.org/uploads",
      });
      expect(customDomainDriver.getUrl("uploads/members/avatar.webp")).toBe(
        "https://assets.pemudacirengit.org/uploads/members/avatar.webp",
      );

      const endpointDriver = new S3Driver({
        bucket: "pemuda-bucket",
        endpoint: "https://minio.local:9000",
        publicBaseUrl: "",
      });
      expect(endpointDriver.getUrl("uploads/members/avatar.webp")).toBe(
        "https://minio.local:9000/pemuda-bucket/uploads/members/avatar.webp",
      );
    });
  });

  describe("Driver Factory & Environment Resolution", () => {
    it("instantiates LocalDriver when driverType is 'local'", () => {
      const driver = createStorageDriver("local");
      expect(driver).toBeInstanceOf(LocalDriver);
    });

    it("instantiates S3Driver when driverType is 's3'", () => {
      const driver = createStorageDriver("s3");
      expect(driver).toBeInstanceOf(S3Driver);
    });

    it("default storage instance is exported and functional", () => {
      expect(storage).toBeDefined();
      expect(typeof storage.upload).toBe("function");
      expect(typeof storage.delete).toBe("function");
      expect(typeof storage.getUrl).toBe("function");
    });
  });

  describe("resolveStorageUrl helper", () => {
    it("normalizes trailing and leading slashes", () => {
      expect(
        resolveStorageUrl("http://localhost:3000/", "/uploads/image.webp"),
      ).toBe("http://localhost:3000/uploads/image.webp");
      expect(
        resolveStorageUrl(
          "http://localhost:3000/uploads/",
          "uploads/image.webp",
        ),
      ).toBe("http://localhost:3000/uploads/image.webp");
    });
  });
});
