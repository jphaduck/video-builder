import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOpenAIClient } from "@/lib/ai";
import { generateStoryDraft } from "@/modules/scripts/service";

vi.mock("@/lib/ai", () => ({
  getOpenAIClient: vi.fn(),
}));

const mockedGetOpenAIClient = vi.mocked(getOpenAIClient);

function createStoryResponse(scriptWordCount: number): string {
  const script = Array.from({ length: scriptWordCount }, () => "you").join(" ");

  return JSON.stringify({
    titleOptions: ["Title One", "Title Two", "Title Three"],
    hook: "You hear the lock turn. You stop moving. You realize the exit is gone.",
    script,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateStoryDraft", () => {
  it("retries once when the first draft is too short for the target runtime", async () => {
    const createCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: createStoryResponse(300) } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: createStoryResponse(500) } }],
      });

    mockedGetOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: createCompletion,
        },
      },
    } as never);

    const result = await generateStoryDraft({
      projectName: "Project One",
      premise: "You discover a system that quietly shapes the lives of everyone around you.",
      theme: "Control versus autonomy inside invisible systems of power.",
      tone: "Controlled, analytical, and quietly oppressive.",
      plotNotes: "You discover the system, investigate it carefully, leak proof, and lose your old life.",
      targetRuntimeMin: 5,
    });

    expect(result.narrationDraft.split(/\s+/)).toHaveLength(500);
    expect(createCompletion).toHaveBeenCalledTimes(2);
    expect(createCompletion.mock.calls[1]?.[0]).toMatchObject({
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("Your previous draft was too short."),
        }),
      ]),
    });
  });
});
