import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

interface StoryGenerationInput {
  projectName: string;
  premise: string;
  theme?: string;
  tone?: string;
  plotNotes?: string;
  targetRuntimeMin: number;
}

interface GeneratedStoryDraft {
  titleOptions: string[];
  hook: string;
  narrationDraft: string;
}

interface BenchmarkInput extends StoryGenerationInput {
  label: string;
}

type ChatStage = "outline" | "script" | "retry" | "unknown";

interface RecordedChatCall {
  stage: ChatStage;
  responseContent: string | null;
  errorMessage: string | null;
}

interface EvalResult {
  inputLabel: string;
  runNumber: number;
  passed: boolean;
  wordCount: number | null;
  paragraphCount: number | null;
  beatCount: number | null;
  titles: string[];
  hookFirstSentence: string | null;
  retryTriggered: boolean;
  errorMessage: string | null;
}

interface EvalSummaryEntry {
  passRate: number;
  avgWordCount: number;
  retryRate: number;
}

interface EvalReport {
  runDate: string;
  totalRuns: number;
  passed: number;
  failed: number;
  results: EvalResult[];
  summary: {
    avgWordCount: number;
    avgParagraphCount: number;
    avgBeatCount: number;
    retryRate: number;
    passRate: number;
    byInput: Record<string, EvalSummaryEntry>;
  };
}

const BENCHMARK_INPUTS: BenchmarkInput[] = [
  {
    label: "CIA surveillance thriller",
    projectName: "CIA surveillance thriller",
    targetRuntimeMin: 5,
    tone: "serious",
    theme:
      "Stepping outside an invisible system of power does not free you from it; it turns you into something the system must model, contain, and outlast.",
    premise:
      "You are a senior CIA systems operator who helped build the infrastructure used to track people across borders. While auditing data flows, you discover a hidden program targeting allies for leverage rather than defense. You leak proof of the program, and then the same quiet system you once operated begins to close around you.",
    plotNotes: [
      "You notice subtle anomalies in internal logs, routing tables, and access permissions that suggest something hidden is moving inside the system.",
      "You verify the anomaly across multiple systems and realize the program targets journalists, politicians, and corporate leaders for leverage.",
      "You model the risk of reporting internally, staying silent, or leaking, and conclude that every option destroys the life you know.",
      "You extract only the files needed to prove scope and intent while keeping your normal work patterns intact.",
      "Small disruptions during the extraction hint that the system may already be aware of you, but nothing confirms it.",
      "You begin quietly separating from your personal life, changing routines and preparing exits before any public fallout appears.",
      "You establish layered contact with a journalist, test trust carefully, and finally transfer the material through controlled channels.",
      "Nothing happens at first, and the silence becomes its own form of warning as internal traffic and quiet coordination increase.",
      "Once the story breaks, your identity is confirmed internally and the intelligence infrastructure begins modeling your next decisions.",
      "You move across borders with shrinking resources until the pressure shifts from active escape to permanent containment and reflection.",
    ].join("\n"),
  },
  {
    label: "Coast guard signals story",
    projectName: "Coast guard signals story",
    targetRuntimeMin: 5,
    tone: "serious",
    theme:
      "A single missed decision can become a private burden that grows heavier with every institutional attempt to explain it away.",
    premise:
      "You are a Coast Guard radio operator who misses a pattern buried inside overlapping distress signals during a storm. By the time the meaning becomes clear, the boats involved are already gone. The official report stays narrow, but you cannot stop reconstructing the sequence and your part in it.",
    plotNotes: [
      "A violent storm overloads the comms room with fragmented calls, static, and competing instructions while you try to keep order.",
      "One signal repeats at odd intervals, but it blends into the noise and never rises above the threshold that would trigger an immediate response.",
      "After the shift, you replay the recordings and notice that the repeated pattern was a plea pointing to a second vessel in worse danger.",
      "You trace the timeline and realize a decision you made to prioritize another call may have erased the only window to intervene.",
      "The search concludes with limited answers, and the official documentation frames the outcome as weather, confusion, and bad luck.",
      "You begin your own reconstruction by comparing logs, weather data, and vessel routes in the hope that the sequence will somehow absolve you.",
      "Instead, each detail deepens the sense that the failure was systemic but still passed directly through your station and your judgment.",
      "Family members of the missing keep asking questions that the institution answers carefully, leaving you caught between policy and guilt.",
      "Months pass, and the missed signal reshapes your routine, your sleep, and the way you hear every burst of radio noise.",
      "The story ends with you accepting that no report can close the gap between what happened and the quiet moment when you might have understood.",
    ].join("\n"),
  },
  {
    label: "Guardianship legal tragedy",
    projectName: "Guardianship legal tragedy",
    targetRuntimeMin: 5,
    tone: "serious",
    theme:
      "Bureaucratic systems can reduce a living person into paperwork so gradually that the loss of autonomy looks legal long before it feels real.",
    premise:
      "You are an adult child trying to regain control over your mother's life after a court-appointed guardian takes over her finances, movement, and medical decisions. Every attempt to challenge the arrangement forces you deeper into a maze of filings, delays, and polite institutional indifference.",
    plotNotes: [
      "What begins as a temporary court intervention after a medical scare quickly hardens into a guardianship with sweeping control.",
      "You realize decisions about money, visitors, medication, and even where your mother can live are now filtered through strangers.",
      "At first you assume the system is correcting a misunderstanding, but each hearing reveals how little room exists to reverse the process.",
      "You gather records, timelines, and witness statements, trying to prove that convenience and routine replaced care long ago.",
      "Every filing creates another waiting period, another required form, and another narrow procedural reason the case cannot yet be heard.",
      "Meanwhile your mother changes inside the arrangement, losing confidence, agency, and language for resisting what is happening.",
      "Friends stop asking for updates because the process seems too technical to explain and too slow to imagine ending.",
      "You begin to understand that the system is not asking whether the arrangement is humane, only whether each step was documented correctly.",
      "Small victories expose larger barriers, and the case becomes a measure of endurance rather than justice.",
      "The story ends with a partial win that arrives too late to restore what was taken, leaving you with proof but not repair.",
    ].join("\n"),
  },
  {
    label: "Corporate whistleblower",
    projectName: "Corporate whistleblower",
    targetRuntimeMin: 5,
    tone: "serious",
    theme:
      "When a company controls the language, metrics, and incentives around harm, speaking plainly becomes a form of professional self-erasure.",
    premise:
      "You are a senior compliance analyst at a pharmaceutical company who uncovers internal evidence that executives knowingly manipulated safety reporting to protect a blockbuster product launch. The deeper you look, the clearer it becomes that the reporting system was designed to delay responsibility rather than discover truth.",
    plotNotes: [
      "You notice irregularities in adverse-event summaries that look small in isolation but form a pattern when compared quarter to quarter.",
      "A deeper review shows certain incidents were recategorized, delayed, or excluded just long enough to preserve launch milestones.",
      "You raise careful questions internally and receive polished answers that address process without touching the underlying risk.",
      "The more documents you review, the more obvious it becomes that compliance language is being used to create deniability.",
      "You begin preserving records, meeting notes, and data exports while keeping your role outwardly unchanged.",
      "Executives announce positive results publicly, and the gap between the official narrative and the internal evidence becomes intolerable.",
      "You weigh whether to go to regulators, the board, or the press, knowing each path makes retaliation almost inevitable.",
      "Once you disclose the material, the company moves quickly to isolate your access, redefine your conduct, and contain the narrative.",
      "Professional relationships cool overnight, and your career narrows as the institution frames self-protection as procedure.",
      "The story ends with the truth finally visible in public, but at the cost of the future you expected to build inside that industry.",
    ].join("\n"),
  },
  {
    label: "Cold case reinvestigation",
    projectName: "Cold case reinvestigation",
    targetRuntimeMin: 5,
    tone: "serious",
    theme:
      "Reopening the past does not restore certainty; it exposes how much of a life can be organized around an explanation that was never fully true.",
    premise:
      "You are a detective assigned to review a cold case that everyone in the department believes was solved years ago. A small inconsistency in archived evidence opens a path back into the case, and each new connection threatens not only the old conclusion but the people who built careers on it.",
    plotNotes: [
      "The case returns to your desk because of a routine archive review, and the first inconsistency seems too minor to matter.",
      "You compare evidence logs, witness statements, and old scene photos and find details that never fit the accepted timeline.",
      "Senior voices around you insist the case is settled, which only sharpens your sense that certain questions stopped being asked too early.",
      "A fresh round of interviews reveals how memory, fear, and departmental pressure shaped the original statements.",
      "You discover that a key piece of evidence was interpreted through a theory that made the rest of the file look cleaner than it was.",
      "The deeper you go, the more the investigation stops being about one crime and starts exposing how the institution protected its earlier certainty.",
      "You reopen relationships, reputations, and grief that had been organized around the original conclusion for years.",
      "Resistance grows inside the department as your findings threaten promotions, legacy, and public trust.",
      "When the corrected timeline finally emerges, it clarifies what happened but also reveals how much damage the first version of the case already did.",
      "The story ends with the truth reconstructed at last, though too late to return anyone to the life they lost while waiting for it.",
    ].join("\n"),
  },
];

function loadEnvLine(rawLine: string): [string, string] | null {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) {
    return null;
  }

  const separatorIndex = line.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = line.slice(0, separatorIndex).trim();
  let value = line.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return key ? [key, value] : null;
}

async function loadLocalEnv(): Promise<void> {
  const envFiles = [".env.local", ".env"];

  for (const envFile of envFiles) {
    const filePath = path.join(process.cwd(), envFile);

    try {
      const fileContents = await fs.readFile(filePath, "utf8");
      for (const rawLine of fileContents.split(/\r?\n/)) {
        const entry = loadEnvLine(rawLine);
        if (!entry) {
          continue;
        }

        const [key, value] = entry;
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}

function countWords(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

function countParagraphs(value: string): number {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean).length;
}

function getFirstSentence(value: string): string | null {
  const sentence = value
    .split(/(?<=[.!?])\s+/)
    .map((entry) => entry.trim())
    .find(Boolean);

  return sentence ?? null;
}

function parseBeatLines(content: string | null): string[] {
  if (!content) {
    return [];
  }

  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+[\.\)]\s+/.test(line))
    .map((line) => line.replace(/^\d+[\.\)]\s+/, "").trim())
    .filter(Boolean);
}

function safeParseStoryOutput(content: string | null): GeneratedStoryDraft | null {
  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as Partial<{
      titleOptions: unknown;
      hook: unknown;
      script: unknown;
    }>;

    if (!Array.isArray(parsed.titleOptions) || typeof parsed.hook !== "string" || typeof parsed.script !== "string") {
      return null;
    }

    if (parsed.titleOptions.some((title) => typeof title !== "string")) {
      return null;
    }

    return {
      titleOptions: parsed.titleOptions as string[],
      hook: parsed.hook,
      narrationDraft: parsed.script,
    };
  } catch {
    return null;
  }
}

function getRequestUrl(input: URL | RequestInfo): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function readRequestBody(body: BodyInit | null | undefined): string {
  if (!body) {
    return "";
  }

  if (typeof body === "string") {
    return body;
  }

  if (body instanceof URLSearchParams) {
    return body.toString();
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body).toString("utf8");
  }

  if (body instanceof ArrayBuffer) {
    return Buffer.from(body).toString("utf8");
  }

  return "";
}

function contentToString(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((entry) => {
        if (typeof entry === "string") {
          return entry;
        }

        if (entry && typeof entry === "object" && "text" in entry && typeof entry.text === "string") {
          return entry.text;
        }

        return "";
      })
      .join("\n");
  }

  return "";
}

function classifyChatStage(messages: unknown[]): ChatStage {
  const normalizedMessages = messages.filter((message): message is { role: string; content: unknown } => {
    return Boolean(message && typeof message === "object" && "role" in message && "content" in message);
  });

  const systemMessage = normalizedMessages.find((message) => message.role === "system");
  const assistantMessage = normalizedMessages.find((message) => message.role === "assistant");
  const systemText = contentToString(systemMessage?.content);

  if (systemText.toLowerCase().includes("story structure editor")) {
    return "outline";
  }

  if (assistantMessage) {
    return "retry";
  }

  if (systemMessage) {
    return "script";
  }

  return "unknown";
}

function createFetchRecorder(calls: RecordedChatCall[]): typeof fetch {
  const originalFetch = globalThis.fetch.bind(globalThis);

  return async (input, init) => {
    const url = getRequestUrl(input);
    const requestBody = readRequestBody(init?.body);
    let stage: ChatStage = "unknown";

    if (url.includes("/chat/completions") && requestBody) {
      try {
        const parsedRequest = JSON.parse(requestBody) as { messages?: unknown[] };
        stage = classifyChatStage(parsedRequest.messages ?? []);
      } catch {
        stage = "unknown";
      }
    }

    try {
      const response = await originalFetch(input, init);

      if (url.includes("/chat/completions")) {
        const cloned = response.clone();
        let responseContent: string | null = null;
        let errorMessage: string | null = null;

        try {
          const payload = (await cloned.json()) as {
            choices?: Array<{ message?: { content?: string | null } }>;
            error?: { message?: string };
          };
          responseContent = payload.choices?.[0]?.message?.content ?? null;
          errorMessage = payload.error?.message ?? null;
        } catch {
          errorMessage = `Non-JSON response from OpenAI (${response.status})`;
        }

        calls.push({
          stage,
          responseContent,
          errorMessage,
        });
      }

      return response;
    } catch (error) {
      if (url.includes("/chat/completions")) {
        calls.push({
          stage,
          responseContent: null,
          errorMessage: error instanceof Error ? error.message : "Unknown fetch error",
        });
      }

      throw error;
    }
  };
}

function round(value: number): number {
  return Number(value.toFixed(1));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function buildSummary(results: EvalResult[]): EvalReport["summary"] {
  const passedResults = results.filter((result) => result.passed);
  const allBeatCounts = results.flatMap((result) => (result.beatCount === null ? [] : [result.beatCount]));
  const retryCount = results.filter((result) => result.retryTriggered).length;

  const byInput = Object.fromEntries(
    BENCHMARK_INPUTS.map((input) => {
      const inputResults = results.filter((result) => result.inputLabel === input.label);
      const inputPassed = inputResults.filter((result) => result.passed);

      return [
        input.label,
        {
          passRate: inputResults.length === 0 ? 0 : round(inputPassed.length / inputResults.length),
          avgWordCount: average(
            inputPassed.flatMap((result) => (result.wordCount === null ? [] : [result.wordCount])),
          ),
          retryRate: inputResults.length === 0 ? 0 : round(inputResults.filter((result) => result.retryTriggered).length / inputResults.length),
        } satisfies EvalSummaryEntry,
      ];
    }),
  );

  return {
    avgWordCount: average(passedResults.flatMap((result) => (result.wordCount === null ? [] : [result.wordCount]))),
    avgParagraphCount: average(
      passedResults.flatMap((result) => (result.paragraphCount === null ? [] : [result.paragraphCount])),
    ),
    avgBeatCount: average(allBeatCounts),
    retryRate: round(results.length === 0 ? 0 : retryCount / results.length),
    passRate: round(results.length === 0 ? 0 : passedResults.length / results.length),
    byInput,
  };
}

function findTopFailureReason(results: EvalResult[]): string | null {
  const counts = new Map<string, number>();

  for (const result of results) {
    if (!result.errorMessage) {
      continue;
    }

    counts.set(result.errorMessage, (counts.get(result.errorMessage) ?? 0) + 1);
  }

  const topEntry = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  return topEntry ? `${topEntry[0]} (${topEntry[1]})` : null;
}

function printSummary(reportPath: string, report: EvalReport): void {
  const topFailureReason = findTopFailureReason(report.results);

  console.log("");
  console.log("Script evaluation complete");
  console.log(`Report: ${reportPath}`);
  console.log(`Overall pass rate: ${formatRate(report.summary.passRate)}`);
  console.log(`Overall average word count: ${report.summary.avgWordCount}`);
  console.log(`Retry rate: ${formatRate(report.summary.retryRate)}`);

  console.log("");
  console.log("Per-input pass rate:");
  for (const [label, entry] of Object.entries(report.summary.byInput)) {
    console.log(
      `- ${label}: ${formatRate(entry.passRate)} pass, avg words ${entry.avgWordCount}, retry ${formatRate(entry.retryRate)}`,
    );
  }

  if (topFailureReason) {
    console.log("");
    console.log(`Top failure reason: ${topFailureReason}`);
  }
}

async function runSingleEvaluation(
  generateStoryDraft: (input: StoryGenerationInput) => Promise<GeneratedStoryDraft>,
  input: BenchmarkInput,
  runNumber: number,
): Promise<EvalResult> {
  const recordedCalls: RecordedChatCall[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createFetchRecorder(recordedCalls);

  try {
    const draft = await generateStoryDraft(input);
    const outlineCall = recordedCalls.find((call) => call.stage === "outline");
    const beatCount = parseBeatLines(outlineCall?.responseContent ?? null).length || null;
    const retryTriggered = recordedCalls.some((call) => call.stage === "retry");

    return {
      inputLabel: input.label,
      runNumber,
      passed: true,
      wordCount: countWords(draft.narrationDraft),
      paragraphCount: countParagraphs(draft.narrationDraft),
      beatCount,
      titles: draft.titleOptions,
      hookFirstSentence: getFirstSentence(draft.hook),
      retryTriggered,
      errorMessage: null,
    };
  } catch (error) {
    const retryCall = [...recordedCalls].reverse().find((call) => call.stage === "retry");
    const scriptCall = [...recordedCalls].reverse().find((call) => call.stage === "script");
    const outlineCall = recordedCalls.find((call) => call.stage === "outline");
    const lastDraft = safeParseStoryOutput(retryCall?.responseContent ?? scriptCall?.responseContent ?? null);
    const beatCount = parseBeatLines(outlineCall?.responseContent ?? null).length || null;

    return {
      inputLabel: input.label,
      runNumber,
      passed: false,
      wordCount: lastDraft ? countWords(lastDraft.narrationDraft) : null,
      paragraphCount: lastDraft ? countParagraphs(lastDraft.narrationDraft) : null,
      beatCount,
      titles: lastDraft?.titleOptions ?? [],
      hookFirstSentence: lastDraft ? getFirstSentence(lastDraft.hook) : null,
      retryTriggered: recordedCalls.some((call) => call.stage === "retry"),
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function loadGenerateStoryDraft(): (input: StoryGenerationInput) => Promise<GeneratedStoryDraft> {
  const { register } = require("ts-node") as typeof import("ts-node");

  register({
    project: path.join(process.cwd(), "tsconfig.json"),
    transpileOnly: true,
    compilerOptions: {
      module: "CommonJS",
      moduleResolution: "node",
    },
  });

  require("tsconfig-paths/register");

  const serviceModule = require(path.join(process.cwd(), "src/modules/scripts/service.ts")) as {
    generateStoryDraft: (input: StoryGenerationInput) => Promise<GeneratedStoryDraft>;
  };

  return serviceModule.generateStoryDraft;
}

async function writeReport(report: EvalReport): Promise<string> {
  const resultsDir = path.join(process.cwd(), "scripts", "eval-results");
  await fs.mkdir(resultsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(resultsDir, `run-${timestamp}.json`);
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  return reportPath;
}

async function main(): Promise<void> {
  await loadLocalEnv();

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to run the script evaluation harness.");
  }

  const generateStoryDraft = loadGenerateStoryDraft();
  const results: EvalResult[] = [];

  for (const input of BENCHMARK_INPUTS) {
    for (let runNumber = 1; runNumber <= 10; runNumber += 1) {
      const result = await runSingleEvaluation(generateStoryDraft, input, runNumber);
      results.push(result);

      const statusLabel = result.passed ? "PASS" : "FAIL";
      console.log(
        `[${statusLabel}] ${input.label} run ${runNumber}/10 | words=${result.wordCount ?? "n/a"} | retry=${result.retryTriggered ? "yes" : "no"}${result.errorMessage ? ` | error=${result.errorMessage}` : ""}`,
      );
    }
  }

  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;
  const report: EvalReport = {
    runDate: new Date().toISOString(),
    totalRuns: results.length,
    passed,
    failed,
    results,
    summary: buildSummary(results),
  };

  const reportPath = await writeReport(report);
  printSummary(reportPath, report);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Script evaluation harness failed: ${message}`);
  process.exitCode = 1;
});
