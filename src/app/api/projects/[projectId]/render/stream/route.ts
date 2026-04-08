import fs from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getLatestRenderJobForProject } from "@/modules/rendering/repository";

type ProjectRenderStreamRouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, { params }: ProjectRenderStreamRouteContext) {
  const { projectId } = await params;
  const trimmedProjectId = projectId.trim();

  if (!trimmedProjectId) {
    return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
  }

  const job = await getLatestRenderJobForProject(trimmedProjectId);
  if (!job?.outputFilePath) {
    return NextResponse.json({ error: "Rendered video not found." }, { status: 404 });
  }

  const absoluteOutputPath = path.join(process.cwd(), job.outputFilePath);
  const fileStat = await stat(absoluteOutputPath);
  const stream = fs.createReadStream(absoluteOutputPath);

  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(fileStat.size),
      "Content-Disposition": `inline; filename=\"${trimmedProjectId}.mp4\"`,
      "Cache-Control": "no-store",
    },
  });
}
