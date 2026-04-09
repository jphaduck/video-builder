import {
  INTERNAL_SERVER_ERROR_MESSAGE,
  PROJECT_NOT_FOUND_ERROR,
  getRequiredParam,
  isPrefixedError,
  jsonData,
  jsonError,
} from "@/app/api/_utils";
import { getProjectById, setProjectStatus } from "@/modules/projects/repository";
import { getTimelineDraftForProject, buildTimelineDraft } from "@/modules/timeline/service";

type ProjectTimelineRouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, { params }: ProjectTimelineRouteContext) {
  const { projectId } = await params;
  const { value: trimmedProjectId, response } = getRequiredParam(projectId, "Project ID");
  if (response || !trimmedProjectId) {
    return response ?? jsonError("Project ID is required.", 400);
  }

  try {
    const project = await getProjectById(trimmedProjectId);
    if (!project) {
      return jsonError(PROJECT_NOT_FOUND_ERROR, 404);
    }

    const draft = await getTimelineDraftForProject(trimmedProjectId);
    return jsonData(draft);
  } catch {
    return jsonError(INTERNAL_SERVER_ERROR_MESSAGE, 500);
  }
}

export async function POST(_request: Request, { params }: ProjectTimelineRouteContext) {
  const { projectId } = await params;
  const { value: trimmedProjectId, response } = getRequiredParam(projectId, "Project ID");
  if (response || !trimmedProjectId) {
    return response ?? jsonError("Project ID is required.", 400);
  }

  try {
    const project = await getProjectById(trimmedProjectId);
    if (!project) {
      return jsonError(PROJECT_NOT_FOUND_ERROR, 404);
    }

    const draft = await buildTimelineDraft(trimmedProjectId);
    await setProjectStatus(trimmedProjectId, "timeline_ready", { clearRenderJobIds: true });
    return jsonData(draft);
  } catch (error) {
    const badRequestMessage = isPrefixedError(error, [
      "Timeline draft requires narration and captions.",
      "Timeline draft requires current narration and caption tracks.",
    ]);
    if (badRequestMessage) {
      return jsonError(badRequestMessage, 400);
    }

    const notFoundMessage = isPrefixedError(error, ["Project not found:"]);
    if (notFoundMessage) {
      return jsonError(PROJECT_NOT_FOUND_ERROR, 404);
    }

    return jsonError(INTERNAL_SERVER_ERROR_MESSAGE, 500);
  }
}
