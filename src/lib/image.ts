import sharp from "sharp";

export interface OptimizeImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  fit?: "inside" | "cover" | "contain";
  withoutEnlargement?: boolean;
}

export interface OptimizedImageResult {
  buffer: Buffer;
  width?: number;
  height?: number;
  format: "webp";
}

/**
 * Optimizes an uploaded image buffer:
 * - Converts to WebP format
 * - Caps max dimension to 1600px (or custom maxWidth/maxHeight) preserving aspect ratio
 * - Never upscales smaller images (withoutEnlargement = true)
 * - Default quality: 80%
 * - Strips EXIF/location metadata
 */
export async function optimizeImage(
  input: Buffer | Uint8Array,
  options: OptimizeImageOptions = {},
): Promise<OptimizedImageResult> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 80,
    fit = "inside",
    withoutEnlargement = true,
  } = options;

  const pipeline = sharp(input)
    .resize(maxWidth, maxHeight, {
      fit,
      withoutEnlargement,
    })
    .webp({ quality });

  const buffer = await pipeline.toBuffer();
  const metadata = await sharp(buffer).metadata();

  return {
    buffer,
    width: metadata.width,
    height: metadata.height,
    format: "webp",
  };
}

/**
 * Generates a square thumbnail (e.g. 400x400px for member avatars) in WebP format.
 */
export async function createThumbnail(
  input: Buffer | Uint8Array,
  size = 400,
  quality = 80,
): Promise<OptimizedImageResult> {
  const pipeline = sharp(input)
    .resize(size, size, {
      fit: "cover",
      withoutEnlargement: true,
    })
    .webp({ quality });

  const buffer = await pipeline.toBuffer();
  const metadata = await sharp(buffer).metadata();

  return {
    buffer,
    width: metadata.width,
    height: metadata.height,
    format: "webp",
  };
}
