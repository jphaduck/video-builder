import {
  INTERNAL_SERVER_ERROR_MESSAGE,
  PROJECT_NOT_FOUND_ERROR,
  getRequiredUuidParam,
  isPrefixedError,
  jsonData,
  jsonError,
} from "@/app/api/_utils";
import { requireProjectRouteAuth } from "@/app/api/projects/_auth";
import { getProjectById, saveMusicSettingsForProject } from "@/modules/projects/repository";
import { enqueueRender, getJobStatus, getLatestJobForProject } from "@/modules/rendering/queue";
import type { ProjectMusicTrack } from "@/types/project";

type ProjectRenderRouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, { params }: ProjectRenderRouteContext) {
  const { projectId } = await params;
  const { value: trimmedProjectId, response } = getRequiredUuidParam(
    projectId,
    "Project ID",
    "Invalid project ID.",
  );
  if (response || !trimmedProjectId) {
    return response ?? jsonError("Invalid project ID.", 400);
  }

  const authResult = await requireProjectRouteAuth();
  if (authResult.response) {
    return authResult.response;
  }
  if (!authResult.userId) {
    return jsonError("Authentication required.", 401);
  }

  try {
    const project = await getProjectById(trimmedProjectId, authResult.userId);
    if (!project) {
      return jsonError(PROJECT_NOT_FOUND_ERROR, 404);
    }

    const job = await getLatestJobForProject(trimmedProjectId);
    return jsonData({
      job,
      renderStatus: job ? (job.status === "queued" ? "rendering" : job.status) : "idle",
    });
  } catch {
    return jsonError(INTERNAL_SERVER_ERROR_MESSAGE, 500);
  }
}

export async function POST(request: Request, { params }: ProjectRenderRouteContext) {
  const { projectId } = await params;
  const { value: trimmedProjectId, response } = getRequiredUuidParam(
    projectId,
    "Project ID",
    "Invalid project ID.",
  );
  if (response || !trimmedProjectId) {
    return response ?? jsonError("Invalid project ID.", 400);
  }

  const authResult = await requireProjectRouteAuth();
  if (authResult.response) {
    return authResult.response;
  }
  if (!authResult.userId) {
    return jsonError("Authentication required.", 401);
  }

  try {
    const project = await getProjectById(trimmedProjectId, authResult.userId);
    if (!project) {
      return jsonError(PROJECT_NOT_FOUND_ERROR, 404);
    }

    let musicTrack: ProjectMusicTrack | undefined;
    try {
      const rawBody = (await request.text()).trim();
      if (rawBody) {
        const parsedBody = JSON.parse(rawBody) as { musicTrack?: unknown };

        if (parsedBody.musicTrack !== undefined) {
          if (
            parsedBody.musicTrack !== "subtle" &&
            parsedBody.musicTrack !== "dramatic" &&
            parsedBody.musicTrack !== "neutral" &&
            parsedBody.musicTrack !== "none"
          ) {
            return jsonError("Invalid music track.", 400);
          }

          musicTrack = parsedBody.musicTrack;
        }
      }
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    if (musicTrack) {
      await saveMusicSettingsForProject(trimmedProjectId, musicTrack, undefined, authResult.userId);
    }

    const jobId = await enqueueRender(trimmedProjectId, authResult.userId);
    const job = await getJobStatus(jobId);

    return jsonData(job ? { ...job, jobId } : { jobId, status: "queued" }, { status: 202 });
  } catch (error) {
    const notFoundMessage = isPrefixedError(error, ["Project not found:"]);
    if (notFoundMessage) {
      return jsonError(PROJECT_NOT_FOUND_ERROR, 404);
    }

    const badRequestMessage = isPrefixedError(error, ["Timeline draft not found for this project."]);
    if (badRequestMessage) {
      return jsonError(badRequestMessage, 400);
    }

    return jsonError(INTERNAL_SERVER_ERROR_MESSAGE, 500);
  }
}
