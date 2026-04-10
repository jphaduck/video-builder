import fs from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import {
  INTERNAL_SERVER_ERROR_MESSAGE,
  PROJECT_NOT_FOUND_ERROR,
  getRequiredUuidParam,
  jsonError,
} from "@/app/api/_utils";
import { getProjectById } from "@/modules/projects/repository";
import { resolveRenderOutputPath } from "@/modules/rendering/paths";
import { getLatestJobForProject } from "@/modules/rendering/queue";

type ProjectRenderStreamRouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, { params }: ProjectRenderStreamRouteContext) {
  const { projectId } = await params;
  const { value: trimmedProjectId, response } = getRequiredUuidParam(
    projectId,
    "Project ID",
    "Invalid project ID.",
  );
  if (response || !trimmedProjectId) {
    return response ?? jsonError("Invalid project ID.", 400);
  }

  try {
    const project = await getProjectById(trimmedProjectId);
    if (!project) {
      return jsonError(PROJECT_NOT_FOUND_ERROR, 404);
    }

    const job = await getLatestJobForProject(trimmedProjectId);
    if (!job?.outputFilePath) {
      return jsonError("Rendered video not found.", 404);
    }

    const absoluteOutputPath = resolveRenderOutputPath(job.outputFilePath);
    if (!absoluteOutputPath) {
      return jsonError("Invalid render output path.", 400);
    }

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
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return jsonError("Rendered video not found.", 404);
    }

    return jsonError(INTERNAL_SERVER_ERROR_MESSAGE, 500);
  }
}
