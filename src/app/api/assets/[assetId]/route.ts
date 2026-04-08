import { constants as fsConstants, createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { getAssetCandidate } from "@/modules/assets/repository";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getContentType(filePath: string): string {
  if (filePath.endsWith(".webp")) {
    return "image/webp";
  }

  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  return "image/png";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;

  if (!UUID_PATTERN.test(assetId)) {
    return NextResponse.json({ error: "Invalid asset path." }, { status: 400 });
  }

  const asset = await getAssetCandidate(assetId);
  if (!asset) {
    return new NextResponse(null, { status: 404 });
  }

  const assetsRoot = path.resolve(process.cwd(), "data", "assets");
  const filePath = path.resolve(process.cwd(), asset.imageFilePath);

  if (!filePath.startsWith(`${assetsRoot}${path.sep}`)) {
    return NextResponse.json({ error: "Invalid asset path." }, { status: 400 });
  }

  try {
    await access(filePath, fsConstants.R_OK);
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  const fileStats = await stat(filePath);
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": getContentType(filePath),
      "Content-Length": fileStats.size.toString(),
      "Cache-Control": "private, max-age=60",
    },
  });
}
