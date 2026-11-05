import fs from "node:fs";
import path from "node:path";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v7 as uuidv7 } from "uuid";
import { env } from "@/env";

export interface StorageDriver {
  upload(
    key: string,
    body: Buffer | Uint8Array,
    contentType: string,
  ): Promise<string>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
  getPresignedUploadUrl?(
    key: string,
    contentType: string,
    expiresInSeconds?: number,
  ): Promise<string>;
}

export type StorageCategory =
  | "members"
  | "activities"
  | "articles"
  | "editor"
  | "system";

/**
 * Normalizes a storage object key to a clean relative key without leading slashes.
 */
export function normalizeStorageKey(key: string): string {
  return key.replace(/^[/\\]+/, "").replace(/\\/g, "/");
}

/**
 * Combines a base URL with a storage object key, preventing duplicate `/uploads` path segments.
 */
export function resolveStorageUrl(baseUrl: string, key: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const cleanKey = normalizeStorageKey(key);

  if (cleanBase.endsWith("/uploads") && cleanKey.startsWith("uploads/")) {
    return `${cleanBase}/${cleanKey.slice("uploads/".length)}`;
  }
  return `${cleanBase}/${cleanKey}`;
}

/**
 * Generates canonical relative storage object key conforming to ADR 005.
 * Format: uploads/<category>/<uuid>.webp
 */
export function generateStorageKey(
  category: StorageCategory,
  id?: string,
): string {
  const identifier = id ?? uuidv7();
  return `uploads/${category}/${identifier}.webp`;
}

export interface LocalDriverOptions {
  publicDir?: string;
  baseUrl?: string;
}

export class LocalDriver implements StorageDriver {
  private publicDir: string;
  private baseUrl: string;

  constructor(options: LocalDriverOptions = {}) {
    this.publicDir = options.publicDir ?? path.join(process.cwd(), "public");
    this.baseUrl =
      options.baseUrl ??
      env.NEXT_PUBLIC_STORAGE_BASE_URL ??
      "http://localhost:3000/uploads";
  }

  async upload(
    key: string,
    body: Buffer | Uint8Array,
    _contentType: string,
  ): Promise<string> {
    const relativeKey = normalizeStorageKey(key);
    const targetPath = path.join(this.publicDir, relativeKey);

    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.writeFile(targetPath, body);

    return relativeKey;
  }

  async delete(key: string): Promise<void> {
    const relativeKey = normalizeStorageKey(key);
    const targetPath = path.join(this.publicDir, relativeKey);

    try {
      await fs.promises.unlink(targetPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  }

  getUrl(key: string): string {
    const relativeKey = normalizeStorageKey(key);
    return resolveStorageUrl(this.baseUrl, relativeKey);
  }

  async getPresignedUploadUrl(
    key: string,
    _contentType: string,
    _expiresInSeconds = 900,
  ): Promise<string> {
    const relativeKey = normalizeStorageKey(key);
    return `${this.baseUrl}/api/uploads/presigned?key=${encodeURIComponent(relativeKey)}`;
  }
}

export interface S3DriverOptions {
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicBaseUrl?: string;
  client?: S3Client;
}

export class S3Driver implements StorageDriver {
  private client: S3Client;
  private bucket: string;
  private endpoint?: string;
  private publicBaseUrl?: string;

  constructor(options: S3DriverOptions = {}) {
    this.bucket = options.bucket ?? env.S3_BUCKET ?? "pemuda";
    this.endpoint = options.endpoint ?? env.S3_ENDPOINT;
    this.publicBaseUrl =
      options.publicBaseUrl !== undefined
        ? options.publicBaseUrl
        : env.NEXT_PUBLIC_STORAGE_BASE_URL;

    if (options.client) {
      this.client = options.client;
    } else {
      this.client = new S3Client({
        endpoint: this.endpoint,
        region: options.region ?? env.S3_REGION ?? "us-east-1",
        credentials: {
          accessKeyId: options.accessKeyId ?? env.S3_ACCESS_KEY_ID ?? "",
          secretAccessKey:
            options.secretAccessKey ?? env.S3_SECRET_ACCESS_KEY ?? "",
        },
        forcePathStyle: true,
      });
    }
  }

  async upload(
    key: string,
    body: Buffer | Uint8Array,
    contentType: string,
  ): Promise<string> {
    const relativeKey = normalizeStorageKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: relativeKey,
        Body: body,
        ContentType: contentType,
      }),
    );
    return relativeKey;
  }

  async delete(key: string): Promise<void> {
    const relativeKey = normalizeStorageKey(key);
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: relativeKey,
      }),
    );
  }

  getUrl(key: string): string {
    const relativeKey = normalizeStorageKey(key);
    if (this.publicBaseUrl && this.publicBaseUrl.length > 0) {
      return resolveStorageUrl(this.publicBaseUrl, relativeKey);
    }
    if (this.endpoint && this.endpoint.length > 0) {
      const cleanEndpoint = this.endpoint.replace(/\/+$/, "");
      return `${cleanEndpoint}/${this.bucket}/${relativeKey}`;
    }
    return `https://${this.bucket}.s3.amazonaws.com/${relativeKey}`;
  }

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds = 900,
  ): Promise<string> {
    const relativeKey = normalizeStorageKey(key);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: relativeKey,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });
  }
}

export function createStorageDriver(
  driverType: "local" | "s3" = env.STORAGE_DRIVER,
): StorageDriver {
  if (driverType === "s3") {
    return new S3Driver();
  }
  return new LocalDriver();
}

export const storage: StorageDriver = createStorageDriver();
