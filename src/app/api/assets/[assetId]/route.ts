import { constants as fsConstants, createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { INTERNAL_SERVER_ERROR_MESSAGE, jsonError } from "@/app/api/_utils";
import { auth } from "@/auth";
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
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Authentication required.", 401);
  }

  const { assetId } = await params;
  const trimmedAssetId = assetId.trim();

  if (!UUID_PATTERN.test(trimmedAssetId)) {
    return jsonError("Invalid asset path.", 400);
  }

  try {
    const asset = await getAssetCandidate(trimmedAssetId);
    if (!asset) {
      return jsonError("Asset not found.", 404);
    }

    const assetsRoot = path.resolve(process.cwd(), "data", "assets");
    const filePath = path.resolve(process.cwd(), asset.imageFilePath);

    if (!filePath.startsWith(`${assetsRoot}${path.sep}`)) {
      return jsonError("Invalid asset path.", 400);
    }

    await access(filePath, fsConstants.R_OK);
    const fileStats = await stat(filePath);
    const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;

    return new NextResponse(stream, {
      headers: {
        "Content-Type": getContentType(filePath),
        "Content-Length": fileStats.size.toString(),
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return jsonError("Asset not found.", 404);
    }

    return jsonError(INTERNAL_SERVER_ERROR_MESSAGE, 500);
  }
}
