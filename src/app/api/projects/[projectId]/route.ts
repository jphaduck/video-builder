import { NextResponse } from "next/server";
import { deleteProjectById } from "@/modules/projects/repository";

type ProjectRouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function DELETE(_request: Request, { params }: ProjectRouteContext) {
  const { projectId } = await params;
  const trimmedProjectId = projectId.trim();

  if (!trimmedProjectId) {
    return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
  }

  try {
    await deleteProjectById(trimmedProjectId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong while deleting the project.";
    const status = message.startsWith("Project not found:") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
