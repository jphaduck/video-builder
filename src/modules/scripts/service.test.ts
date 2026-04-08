import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOpenAIClient } from "@/lib/ai";
import { generateBeatOutline, generateStoryDraft } from "@/modules/scripts/service";

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

function createInput(overrides?: Partial<ReturnType<typeof createInputBase>>) {
  return {
    ...createInputBase(),
    ...overrides,
  };
}

function createInputBase() {
  return {
    projectName: "Project One",
    premise: "You discover a system that quietly shapes the lives of everyone around you.",
    theme: "Control versus autonomy inside invisible systems of power.",
    tone: "Controlled, analytical, and quietly oppressive.",
    plotNotes: "You discover the system, investigate it carefully, leak proof, and lose your old life.",
    targetRuntimeMin: 5,
  };
}

function createBeatOutlineResponse(count = 12): string {
  return Array.from(
    { length: count },
    (_, index) => `${index + 1}. You face beat ${index + 1}, the situation changes, and the stakes rise.`,
  ).join("\n");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateStoryDraft", () => {
  it("uses the lowered paragraph minimum for a 5-minute draft", async () => {
    const createCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: createBeatOutlineResponse() } }],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: createStoryResponse({ paragraphWordCounts: [90, 82, 82, 82, 82, 82, 82, 82] }),
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

    await generateStoryDraft(createInput());

    expect(createCompletion.mock.calls[1]?.[0]).toMatchObject({
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("Minimum paragraph count: 8"),
        }),
      ]),
    });
    expect(createCompletion.mock.calls[1]?.[0]).toMatchObject({
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining(
            "The minimum word count is a floor, not the finish line. Do not stop just because you crossed it.",
          ),
        }),
      ]),
    });
  });

  it("uses a 24-paragraph minimum for a 20-minute draft prompt", async () => {
    const createCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: createBeatOutlineResponse(20) } }],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: createStoryResponse({ paragraphWordCounts: new Array(24).fill(110) }),
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

    await generateStoryDraft(createInput({ targetRuntimeMin: 20 }));

    expect(createCompletion.mock.calls[1]?.[0]).toMatchObject({
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("Minimum paragraph count: 24"),
        }),
      ]),
    });
  });

  it("generateBeatOutline returns a non-empty list of beats", async () => {
    const createCompletion = vi.fn().mockResolvedValue({
      choices: [{ message: { content: createBeatOutlineResponse() } }],
    });

    mockedGetOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: createCompletion,
        },
      },
    } as never);

    const outline = await generateBeatOutline(createInput());

    expect(outline.length).toBeGreaterThan(0);
    expect(outline[0]).toContain("You face beat 1");
  });

  it("generateBeatOutline throws when fewer than 8 beats are returned", async () => {
    const createCompletion = vi.fn().mockResolvedValue({
      choices: [{ message: { content: createBeatOutlineResponse(7) } }],
    });

    mockedGetOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: createCompletion,
        },
      },
    } as never);

    await expect(generateBeatOutline(createInput())).rejects.toThrow(
      "Beat outline returned too few beats (7). Generation aborted.",
    );
  });

  it("generateBeatOutline throws when the response cannot be parsed", async () => {
    const createCompletion = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "Beat one opens the story.\nBeat two raises the stakes." } }],
    });

    mockedGetOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: createCompletion,
        },
      },
    } as never);

    await expect(generateBeatOutline(createInput())).rejects.toThrow(
      "Beat outline could not be parsed. Generation aborted.",
    );
  });

  it("retries once when the first draft is too short for the target runtime", async () => {
    const firstDraft = createStoryResponse({ paragraphWordCounts: [150, 150] });
    const createCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: createBeatOutlineResponse() } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: firstDraft } }],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: createStoryResponse({ paragraphWordCounts: [70, 64, 64, 64, 64, 64, 64, 64, 64, 64, 60] }),
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

    expect(result.narrationDraft.split(/\s+/)).toHaveLength(706);
    expect(createCompletion).toHaveBeenCalledTimes(3);
    expect(createCompletion.mock.calls[1]?.[0]).toMatchObject({
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("Beat outline:"),
        }),
      ]),
    });
    expect(createCompletion.mock.calls[2]?.[0]).toMatchObject({
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: expect.stringContaining("Title options:"),
        }),
      ]),
    });
    expect(createCompletion.mock.calls[2]?.[0]).toMatchObject({
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("Keep the opening paragraph exactly as written."),
        }),
      ]),
    });
    expect(createCompletion.mock.calls[2]?.[0]).toMatchObject({
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("Target: at least 650 words and 8 paragraphs."),
        }),
      ]),
    });
    expect(createCompletion.mock.calls[2]?.[0]).toMatchObject({
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: expect.stringContaining("Hook:"),
        }),
      ]),
    });
  });

  it("retries when the first draft is long enough but too compressed", async () => {
    const createCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: createBeatOutlineResponse() } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: createStoryResponse({ paragraphWordCounts: [290, 290] }) } }],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: createStoryResponse({ paragraphWordCounts: [70, 64, 64, 64, 64, 64, 64, 64, 64, 64, 60] }),
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

    expect(result.narrationDraft.split(/\n{2,}/)).toHaveLength(11);
    expect(createCompletion).toHaveBeenCalledTimes(3);
    expect(createCompletion.mock.calls[2]?.[0]).toMatchObject({
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("Expand the middle section by adding 3-5 new paragraphs."),
        }),
      ]),
    });
    expect(createCompletion.mock.calls[2]?.[0]).toMatchObject({
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining(
            "Deepen procedural detail, internal decision-making, and environmental atmosphere in the escalation and attrition sections.",
          ),
        }),
      ]),
    });
    expect(createCompletion.mock.calls[2]?.[0]).toMatchObject({
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining(
            "For quieter, procedural, or bureaucratic stories, treat paperwork, waiting, compliance pressure, professional isolation, and the lived consequences of each choice as real story beats rather than background exposition.",
          ),
        }),
      ]),
    });
  });

  it("rejects title fragments and incomplete titles", async () => {
    const createCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: createBeatOutlineResponse() } }],
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
    expect(createCompletion).toHaveBeenCalledTimes(3);
  });

  it("rejects drafts that still have too few paragraphs after one retry", async () => {
    const createCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: createBeatOutlineResponse() } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: createStoryResponse({ paragraphWordCounts: [340, 340] }) } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: createStoryResponse({ paragraphWordCounts: [340, 340] }) } }],
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
    expect(createCompletion).toHaveBeenCalledTimes(3);
  });

  it("passes a fuller long-form draft with strong paragraph structure", async () => {
    const createCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: createBeatOutlineResponse() } }],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: createStoryResponse({ paragraphWordCounts: [70, 64, 64, 64, 64, 64, 64, 64, 64, 64, 60] }),
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
    expect(result.sceneOutline.length).toBeGreaterThanOrEqual(10);
    expect(createCompletion).toHaveBeenCalledTimes(2);
  });

  it("rejects a 5-minute draft that is only 580 words", async () => {
    const createCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: createBeatOutlineResponse() } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: createStoryResponse({ paragraphWordCounts: [290, 290] }) } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: createStoryResponse({ paragraphWordCounts: [290, 290] }) } }],
      });

    mockedGetOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: createCompletion,
        },
      },
    } as never);

    await expect(generateStoryDraft(createInput())).rejects.toThrow("Retry draft is still too short for target runtime.");
  });

  it("passes a 5-minute draft that is 700+ words and 11 paragraphs", async () => {
    const createCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: createBeatOutlineResponse() } }],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: createStoryResponse({ paragraphWordCounts: [70, 64, 64, 64, 64, 64, 64, 64, 64, 64, 60] }),
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

    expect(result.narrationDraft.split(/\s+/)).toHaveLength(706);
    expect(result.narrationDraft.split(/\n{2,}/)).toHaveLength(11);
  });
});
