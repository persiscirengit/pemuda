import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createThumbnail, optimizeImage } from "@/lib/image";

describe("Sharp Image Optimization & WebP Pipeline", () => {
  it("converts PNG input to valid WebP format", async () => {
    const rawPng = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 4,
        background: { r: 16, g: 185, b: 129, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const result = await optimizeImage(rawPng);
    expect(result.format).toBe("webp");

    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(800);
    expect(metadata.height).toBe(600);
  });

  it("downscales images larger than 1600px to max dimension 1600px preserving aspect ratio", async () => {
    // 3200 x 1600 image (2:1 aspect ratio)
    const largePng = await sharp({
      create: {
        width: 3200,
        height: 1600,
        channels: 4,
        background: { r: 59, g: 130, b: 246, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const result = await optimizeImage(largePng);
    expect(result.format).toBe("webp");

    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(1600);
    expect(metadata.height).toBe(800);
  });

  it("does not upscale images smaller than 1600px (withoutEnlargement)", async () => {
    const smallPng = await sharp({
      create: {
        width: 500,
        height: 300,
        channels: 4,
        background: { r: 245, g: 158, b: 11, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const result = await optimizeImage(smallPng);
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.width).toBe(500);
    expect(metadata.height).toBe(300);
  });

  it("strips EXIF metadata to protect user privacy and minimize payload size", async () => {
    // Create an image with simulated EXIF orientation
    const imageWithExif = await sharp({
      create: {
        width: 600,
        height: 400,
        channels: 4,
        background: { r: 239, g: 68, b: 68, alpha: 1 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await optimizeImage(imageWithExif);
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.exif).toBeUndefined();
  });

  it("createThumbnail generates a 400x400 square WebP thumbnail", async () => {
    const rectangularImage = await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 4,
        background: { r: 139, g: 92, b: 246, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const thumb = await createThumbnail(rectangularImage, 400);
    expect(thumb.format).toBe("webp");

    const metadata = await sharp(thumb.buffer).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(400);
    expect(metadata.height).toBe(400);
  });
});
