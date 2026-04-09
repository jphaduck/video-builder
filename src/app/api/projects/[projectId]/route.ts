import { INTERNAL_SERVER_ERROR_MESSAGE, getRequiredParam, jsonData, jsonError, isPrefixedError } from "@/app/api/_utils";
import { deleteProjectById } from "@/modules/projects/repository";

type ProjectRouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function DELETE(_request: Request, { params }: ProjectRouteContext) {
  const { projectId } = await params;
  const { value: trimmedProjectId, response } = getRequiredParam(projectId, "Project ID");
  if (response || !trimmedProjectId) {
    return response ?? jsonError("Project ID is required.", 400);
  }

  try {
    await deleteProjectById(trimmedProjectId);
    return jsonData({ deleted: true });
  } catch (error) {
    const notFoundMessage = isPrefixedError(error, ["Project not found:"]);
    if (notFoundMessage) {
      return jsonError(notFoundMessage, 404);
    }

    return jsonError(INTERNAL_SERVER_ERROR_MESSAGE, 500);
  }
}
