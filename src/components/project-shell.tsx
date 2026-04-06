import { SectionCard } from "@/components/section-card";

type ProjectShellProps = {
  isScriptApproved: boolean;
};

function buildProjectSections(isScriptApproved: boolean) {
  return [
    { title: "Script", description: "Draft, edit, compare, and approve script versions." },
    {
      title: "Scenes",
      description: isScriptApproved
        ? "Scene planning is unlocked because a script draft is approved."
        : "Scene planning is locked until you approve one script draft.",
    },
    { title: "Assets", description: "Manage still-image prompts and selected visuals." },
    { title: "Narration", description: "Voiceover settings and narration regeneration controls." },
    { title: "Captions", description: "Caption review and timing edits." },
    { title: "Render", description: "Assemble timeline and export final video." },
  ];
}

export function ProjectShell({ isScriptApproved }: ProjectShellProps) {
  const projectSections = buildProjectSections(isScriptApproved);

  return (
    <div className="grid grid-2">
      {projectSections.map((section) => (
        <SectionCard key={section.title} title={section.title} description={section.description} />
      ))}
    </div>
  );
}
