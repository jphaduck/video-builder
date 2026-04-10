import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RenderPanel } from "@/components/render-panel";
import type { RenderJob } from "@/modules/rendering/types";

const mockedFetch = vi.fn();

class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  close = vi.fn();
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
}

function createRenderJob(overrides: Partial<RenderJob> = {}): RenderJob {
  return {
    id: "render-1",
    projectId: "project-1",
    timelineDraftId: "timeline-1",
    status: "queued",
    outputFilePath: null,
    errorMessage: null,
    progressMessage: "Queued render job.",
    createdAt: "2026-04-09T00:00:00.000Z",
    updatedAt: "2026-04-09T00:00:00.000Z",
    ...overrides,
  };
}

describe("RenderPanel", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    mockedFetch.mockReset();
    vi.stubGlobal("fetch", mockedFetch);
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts rendering when the API returns the standardized data envelope", async () => {
    const job = createRenderJob();
    mockedFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: job }),
    });

    render(<RenderPanel projectId="project-1" initialRenderJob={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Render Video" }));

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith("/api/projects/project-1/render", { method: "POST" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Rendering Video..." })).toBeDisabled(),
    );
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    expect(MockEventSource.instances[0]?.url).toBe("/api/projects/project-1/render/progress");
    expect(screen.queryByText("Failed to start the render job.")).not.toBeInTheDocument();
  });

  it("shows a request error when starting the render fails", async () => {
    mockedFetch.mockRejectedValue(new Error("network down"));

    render(<RenderPanel projectId="project-1" initialRenderJob={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Render Video" }));

    expect(await screen.findByText("Failed to start the render job.")).toBeInTheDocument();
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("surfaces progress stream disconnects while a render is active", async () => {
    render(<RenderPanel projectId="project-1" initialRenderJob={createRenderJob()} />);

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    await act(async () => {
      MockEventSource.instances[0]?.onerror?.();
    });

    expect(
      await screen.findByText("Lost live render progress updates. Refresh the page to check the current render status."),
    ).toBeInTheDocument();
    expect(MockEventSource.instances[0]?.close).toHaveBeenCalled();
  });
});
