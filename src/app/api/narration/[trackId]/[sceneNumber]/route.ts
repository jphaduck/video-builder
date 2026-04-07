import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { constants as fsConstants } from "node:fs";
import { NextRequest, NextResponse } from "next/server";

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

  if (!isSafeNarrationParam(trackId, sceneNumber)) {
    return NextResponse.json({ error: "Invalid narration asset path." }, { status: 400 });
  }

  const narrationRoot = path.resolve(process.cwd(), "data", "narration");
  const trackDirectory = path.resolve(narrationRoot, trackId);
  const filePath = path.resolve(trackDirectory, `scene-${sceneNumber}.mp3`);

  if (!filePath.startsWith(`${trackDirectory}${path.sep}`)) {
    return NextResponse.json({ error: "Invalid narration asset path." }, { status: 400 });
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
      "Content-Type": "audio/mpeg",
      "Content-Length": fileStats.size.toString(),
    },
  });
}
