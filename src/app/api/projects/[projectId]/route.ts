import {
  INTERNAL_SERVER_ERROR_MESSAGE,
  PROJECT_NOT_FOUND_ERROR,
  getRequiredUuidParam,
  jsonData,
  jsonError,
  isPrefixedError,
} from "@/app/api/_utils";
import { requireProjectRouteAuth } from "@/app/api/projects/_auth";
import { deleteProjectById } from "@/modules/projects/repository";

type ProjectRouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function DELETE(_request: Request, { params }: ProjectRouteContext) {
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

  try {
    await deleteProjectById(trimmedProjectId);
    return jsonData({ deleted: true });
  } catch (error) {
    const notFoundMessage = isPrefixedError(error, ["Project not found:"]);
    if (notFoundMessage) {
      return jsonError(PROJECT_NOT_FOUND_ERROR, 404);
    }

    return jsonError(INTERNAL_SERVER_ERROR_MESSAGE, 500);
  }
}
