import type { WorkflowSection } from "@/lib/types/workflow";
import { SectionCard } from "@/components/section-card";

type ProjectShellProps = {
  isScriptApproved: boolean;
  isScenePlanApproved?: boolean;
};

function buildProjectSections(isScriptApproved: boolean, isScenePlanApproved: boolean): WorkflowSection[] {
  return [
    { module: "scripts", title: "Script", description: "Draft, edit, compare, reject, and approve script versions." },
    {
      module: "scenes",
      title: "Scenes",
      description: isScenePlanApproved
        ? "Scene plan approved. Image generation is the next locked stage."
        : isScriptApproved
          ? "Scene planning is unlocked for review, editing, regeneration, and approval."
          : "Scene planning is locked until you approve one script draft.",
    },
    { module: "assets", title: "Assets", description: "Manage still-image prompts and selected visuals." },
    { module: "narration", title: "Narration", description: "Voiceover settings and narration regeneration controls." },
    { module: "captions", title: "Captions", description: "Caption review and timing edits." },
    { module: "rendering", title: "Render", description: "Assemble timeline and export final video." },
  ];
}

export function ProjectShell({ isScriptApproved, isScenePlanApproved = false }: ProjectShellProps) {
  const projectSections = buildProjectSections(isScriptApproved, isScenePlanApproved);

  return (
    <div className="grid grid-2">
      {projectSections.map((section) => (
        <SectionCard key={section.module} title={section.title} description={section.description} />
      ))}
    </div>
  );
}
