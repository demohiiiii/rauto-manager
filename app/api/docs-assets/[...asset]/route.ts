import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SCREENSHOT_ROOT = path.resolve(process.cwd(), "docs", "screenshots");

const CONTENT_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ asset: string[] }> },
) {
  const { asset } = await context.params;

  if (!asset.length || asset[0] !== "screenshots") {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const assetPath = path.resolve(SCREENSHOT_ROOT, ...asset.slice(1));

  if (
    assetPath !== SCREENSHOT_ROOT &&
    !assetPath.startsWith(`${SCREENSHOT_ROOT}${path.sep}`)
  ) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  try {
    const [buffer, stat] = await Promise.all([fs.readFile(assetPath), fs.stat(assetPath)]);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const ext = path.extname(assetPath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": contentType,
      },
    });
  } catch {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }
}
