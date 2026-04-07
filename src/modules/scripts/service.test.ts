import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOpenAIClient } from "@/lib/ai";
import { generateStoryDraft } from "@/modules/scripts/service";

vi.mock("@/lib/ai", () => ({
  getOpenAIClient: vi.fn(),
}));

const mockedGetOpenAIClient = vi.mocked(getOpenAIClient);

function createParagraph(wordCount: number): string {
  return Array.from({ length: wordCount }, () => "you").join(" ");
}

function createStoryResponse(options?: {
  titles?: string[];
  hook?: string;
  paragraphWordCounts?: number[];
}): string {
  const paragraphWordCounts = options?.paragraphWordCounts ?? [90, 90, 90, 90, 90, 90];
  const script = paragraphWordCounts.map((wordCount) => createParagraph(wordCount)).join("\n\n");

  return JSON.stringify({
    titleOptions: options?.titles ?? ["Title One Complete", "Title Two Complete", "Title Three Complete"],
    hook:
      options?.hook ??
      "You hear the lock turn behind you. You stop moving in the dark. You realize the exit is already gone.",
    script,
  });
}

function createInput() {
  return {
    projectName: "Project One",
    premise: "You discover a system that quietly shapes the lives of everyone around you.",
    theme: "Control versus autonomy inside invisible systems of power.",
    tone: "Controlled, analytical, and quietly oppressive.",
    plotNotes: "You discover the system, investigate it carefully, leak proof, and lose your old life.",
    targetRuntimeMin: 5 as const,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateStoryDraft", () => {
  it("retries once when the first draft is too short for the target runtime", async () => {
    const createCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: createStoryResponse({ paragraphWordCounts: [150, 150] }) } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: createStoryResponse({ paragraphWordCounts: [85, 85, 85, 85, 85, 85] }) } }],
      });

    mockedGetOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: createCompletion,
        },
      },
    } as never);

    const result = await generateStoryDraft(createInput());

    expect(result.narrationDraft.split(/\s+/)).toHaveLength(510);
    expect(createCompletion).toHaveBeenCalledTimes(2);
    expect(createCompletion.mock.calls[1]?.[0]).toMatchObject({
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("The \"script\" field must be at least 500 words."),
        }),
      ]),
    });
  });

  it("retries when the first draft is long enough but too compressed", async () => {
    const createCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: createStoryResponse({ paragraphWordCounts: [260, 260] }) } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: createStoryResponse({ paragraphWordCounts: [85, 85, 85, 85, 85, 85] }) } }],
      });

    mockedGetOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: createCompletion,
        },
      },
    } as never);

    const result = await generateStoryDraft(createInput());

    expect(result.narrationDraft.split(/\n{2,}/)).toHaveLength(6);
    expect(createCompletion).toHaveBeenCalledTimes(2);
    expect(createCompletion.mock.calls[1]?.[0]).toMatchObject({
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("Add more scene-level detail instead of summarizing events."),
        }),
      ]),
    });
  });

  it("rejects title fragments and incomplete titles", async () => {
    const createCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: createStoryResponse({
                titles: ["Title One Complete", "Behind Enemy Lines: The CIA's Own", "Title Three Complete"],
              }),
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: createStoryResponse({
                titles: ["Title One Complete", "Behind Enemy Lines: The CIA's Own", "Title Three Complete"],
              }),
            },
          },
        ],
      });

    mockedGetOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: createCompletion,
        },
      },
    } as never);

    await expect(generateStoryDraft(createInput())).rejects.toThrow(
      "OpenAI response titles must be complete and publication-ready.",
    );
    expect(createCompletion).toHaveBeenCalledTimes(2);
  });

  it("rejects drafts that still have too few paragraphs after one retry", async () => {
    const createCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: createStoryResponse({ paragraphWordCounts: [260, 260] }) } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: createStoryResponse({ paragraphWordCounts: [260, 260] }) } }],
      });

    mockedGetOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: createCompletion,
        },
      },
    } as never);

    await expect(generateStoryDraft(createInput())).rejects.toThrow(
      "OpenAI response script does not have enough paragraph structure for the target runtime.",
    );
    expect(createCompletion).toHaveBeenCalledTimes(2);
  });

  it("passes a fuller long-form draft with strong paragraph structure", async () => {
    const createCompletion = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: createStoryResponse({ paragraphWordCounts: [90, 85, 80, 90, 85, 80, 85] }),
          },
        },
      ],
    });

    mockedGetOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: createCompletion,
        },
      },
    } as never);

    const result = await generateStoryDraft(createInput());

    expect(result.titleOptions).toEqual(["Title One Complete", "Title Two Complete", "Title Three Complete"]);
    expect(result.sceneOutline.length).toBeGreaterThanOrEqual(6);
    expect(createCompletion).toHaveBeenCalledTimes(1);
  });
});
