import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ trackId: string; sceneNumber: string }> },
) {
  const { trackId, sceneNumber } = await params;
  const filePath = path.join(process.cwd(), "data", "narration", trackId, `scene-${sceneNumber}.mp3`);

  if (!fs.existsSync(filePath)) {
    return new NextResponse(null, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": buffer.byteLength.toString(),
    },
  });
}
