import type { WorkflowSection } from "@/lib/types/workflow";
import { SectionCard } from "@/components/section-card";

type ProjectShellProps = {
  isScriptApproved: boolean;
  isScenePlanApproved?: boolean;
  isTimelineReady?: boolean;
};

function buildProjectSections(
  isScriptApproved: boolean,
  isScenePlanApproved: boolean,
  isTimelineReady: boolean,
): WorkflowSection[] {
  return [
    { module: "scripts", title: "Script", description: "Draft, edit, compare, reject, and approve script versions." },
    {
      module: "scenes",
      title: "Scenes",
      description: isScenePlanApproved
        ? "Scene plan approved. Still-image generation is unlocked for each approved scene."
        : isScriptApproved
          ? "Scene planning is unlocked for review, editing, regeneration, and approval."
          : "Scene planning is locked until you approve one script draft.",
    },
    {
      module: "assets",
      title: "Assets",
      description: isScenePlanApproved
        ? "Generate image candidates, choose one still per scene, and approve the image plan."
        : "Still-image generation unlocks after the full scene plan is approved.",
    },
    { module: "narration", title: "Narration", description: "Voiceover settings and narration regeneration controls." },
    { module: "captions", title: "Captions", description: "Caption review and timing edits." },
    {
      module: "rendering",
      title: "Render",
      description: isTimelineReady ? "Timeline draft saved. Final rendering is the next step." : "Assemble timeline and export final video.",
    },
  ];
}

export function ProjectShell({ isScriptApproved, isScenePlanApproved = false, isTimelineReady = false }: ProjectShellProps) {
  const projectSections = buildProjectSections(isScriptApproved, isScenePlanApproved, isTimelineReady);

  return (
    <div className="grid grid-2">
      {projectSections.map((section) => (
        <SectionCard key={section.module} title={section.title} description={section.description} />
      ))}
    </div>
  );
}
