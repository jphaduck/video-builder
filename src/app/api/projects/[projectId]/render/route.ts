import {
  INTERNAL_SERVER_ERROR_MESSAGE,
  PROJECT_NOT_FOUND_ERROR,
  getRequiredUuidParam,
  isPrefixedError,
  jsonData,
  jsonError,
} from "@/app/api/_utils";
import { getProjectById } from "@/modules/projects/repository";
import { getLatestRenderJobForProject } from "@/modules/rendering/repository";
import { startRenderForProject } from "@/modules/rendering/service";

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

  try {
    const project = await getProjectById(trimmedProjectId);
    if (!project) {
      return jsonError(PROJECT_NOT_FOUND_ERROR, 404);
    }

    const job = await getLatestRenderJobForProject(trimmedProjectId);
    return jsonData({
      job,
      renderStatus: job ? (job.status === "pending" ? "rendering" : job.status) : "idle",
    });
  } catch {
    return jsonError(INTERNAL_SERVER_ERROR_MESSAGE, 500);
  }
}

export async function POST(_request: Request, { params }: ProjectRenderRouteContext) {
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

    const job = await startRenderForProject(trimmedProjectId);
    return jsonData(job, { status: 202 });
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
