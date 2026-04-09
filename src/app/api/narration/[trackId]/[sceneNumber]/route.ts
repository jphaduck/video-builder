import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { constants as fsConstants } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { INTERNAL_SERVER_ERROR_MESSAGE, jsonError } from "@/app/api/_utils";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SCENE_NUMBER_PATTERN = /^[1-9]\d*$/;

function isSafeNarrationParam(trackId: string, sceneNumber: string): boolean {
  return UUID_PATTERN.test(trackId) && SCENE_NUMBER_PATTERN.test(sceneNumber);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ trackId: string; sceneNumber: string }> },
) {
  const { trackId, sceneNumber } = await params;
  const trimmedTrackId = trackId.trim();
  const trimmedSceneNumber = sceneNumber.trim();

  if (!isSafeNarrationParam(trimmedTrackId, trimmedSceneNumber)) {
    return jsonError("Invalid narration asset path.", 400);
  }

  const narrationRoot = path.resolve(process.cwd(), "data", "narration");
  const trackDirectory = path.resolve(narrationRoot, trimmedTrackId);
  const filePath = path.resolve(trackDirectory, `scene-${trimmedSceneNumber}.mp3`);

  if (!filePath.startsWith(`${trackDirectory}${path.sep}`)) {
    return jsonError("Invalid narration asset path.", 400);
  }

  try {
    await access(filePath, fsConstants.R_OK);
    const fileStats = await stat(filePath);
    const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": fileStats.size.toString(),
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return jsonError("Narration audio not found.", 404);
    }

    return jsonError(INTERNAL_SERVER_ERROR_MESSAGE, 500);
  }
}
