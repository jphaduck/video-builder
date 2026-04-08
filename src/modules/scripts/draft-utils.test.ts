import { describe, expect, it } from "vitest";
import { buildSceneOutline } from "@/modules/scripts/draft-utils";

describe("buildSceneOutline", () => {
  it("derives stable scene headings from multi-paragraph narration", () => {
    const script = [
      "You notice the first anomaly in a silent server room, where a clean audit trail suddenly no longer lines up with the data flowing underneath it.",
      "You keep your face still, rerun the query, and realize the discrepancy is not random but deliberate.",
      "Days later, you begin a careful extraction, copying only the fragments that prove intent while pretending your routines have not changed at all.",
      "Every minor delay in the system feels louder now, and each prompt or timeout makes you wonder whether the infrastructure already knows what you are doing.",
      "After the leak, the silence is worse than alarm. Airports, banks, and border systems do not stop you outright, but the world begins narrowing around your decisions.",
      "In the end, you settle into a life that functions but cannot expand, and the permanence of that containment matters more than any single dramatic chase ever could.",
    ].join("\n\n");

    const outline = buildSceneOutline(script);

    expect(outline).toHaveLength(6);
    expect(outline[0]).toMatchObject({
      sceneNumber: 1,
      heading: "You Notice The First Anomaly",
    });
    expect(outline[3]?.heading).toBe("Every Minor Delay In The System Feels Louder");
    expect(outline.at(-1)?.summary).toContain("life that functions but cannot expand");
  });
});
