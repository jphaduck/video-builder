import { NextResponse } from "next/server";
import { setProjectStatus } from "@/modules/projects/repository";
import { getTimelineDraftForProject, buildTimelineDraft } from "@/modules/timeline/service";

type ProjectTimelineRouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, { params }: ProjectTimelineRouteContext) {
  const { projectId } = await params;
  const trimmedProjectId = projectId.trim();

  if (!trimmedProjectId) {
    return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
  }

  try {
    const draft = await getTimelineDraftForProject(trimmedProjectId);
    return NextResponse.json({ ok: true, data: draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong while loading the timeline draft.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(_request: Request, { params }: ProjectTimelineRouteContext) {
  const { projectId } = await params;
  const trimmedProjectId = projectId.trim();

  if (!trimmedProjectId) {
    return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
  }

  try {
    const draft = await buildTimelineDraft(trimmedProjectId);
    await setProjectStatus(trimmedProjectId, "timeline_ready", { clearRenderJobIds: true });
    return NextResponse.json({ ok: true, data: draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong while building the timeline draft.";
    const status = message.startsWith("Project not found:") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
