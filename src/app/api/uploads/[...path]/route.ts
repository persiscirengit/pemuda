import fs from "node:fs";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";

const MIME_MAP: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: pathSegments } = await context.params;

  if (!pathSegments || pathSegments.length === 0) {
    return new NextResponse("File path required", { status: 400 });
  }

  // Prevent directory traversal attacks
  const safeSegments = pathSegments.map((segment) => path.basename(segment));
  const relativeFilePath = path.join("uploads", ...safeSegments);
  const fullFilePath = path.join(process.cwd(), "public", relativeFilePath);

  // Security check: verify resolved path remains within public directory
  const publicDir = path.join(process.cwd(), "public");
  if (!fullFilePath.startsWith(publicDir)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(fullFilePath)) {
    return new NextResponse("File not found", { status: 404 });
  }

  try {
    const fileBuffer = await fs.promises.readFile(fullFilePath);
    const ext = path.extname(fullFilePath).toLowerCase();
    const contentType = MIME_MAP[ext] ?? "application/octet-stream";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
