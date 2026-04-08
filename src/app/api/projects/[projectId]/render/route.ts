import { NextResponse } from "next/server";
import { getLatestRenderJobForProject } from "@/modules/rendering/repository";
import { startRenderForProject } from "@/modules/rendering/service";

type ProjectRenderRouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, { params }: ProjectRenderRouteContext) {
  const { projectId } = await params;
  const trimmedProjectId = projectId.trim();

  if (!trimmedProjectId) {
    return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
  }

  try {
    const job = await getLatestRenderJobForProject(trimmedProjectId);
    return NextResponse.json({
      ok: true,
      data: job,
      renderStatus: job ? (job.status === "pending" ? "rendering" : job.status) : "idle",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong while loading render status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(_request: Request, { params }: ProjectRenderRouteContext) {
  const { projectId } = await params;
  const trimmedProjectId = projectId.trim();

  if (!trimmedProjectId) {
    return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
  }

  try {
    const job = await startRenderForProject(trimmedProjectId);
    return NextResponse.json({ ok: true, data: job }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong while starting the render.";
    const status =
      message.startsWith("Project not found:") ? 404 : message.startsWith("Timeline draft not found") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
