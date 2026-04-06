import { SectionCard } from "@/components/section-card";

const projectSections = [
  { title: "Script", description: "Draft, edit, and approve script versions." },
  { title: "Scenes", description: "Plan scene pacing and narrative beats." },
  { title: "Assets", description: "Manage still-image prompts and selected visuals." },
  { title: "Narration", description: "Voiceover settings and narration regeneration controls." },
  { title: "Captions", description: "Caption review and timing edits." },
  { title: "Render", description: "Assemble timeline and export final video." },
];

export function ProjectShell() {
  return (
    <div className="grid grid-2">
      {projectSections.map((section) => (
        <SectionCard key={section.title} title={section.title} description={section.description} />
      ))}
    </div>
  );
}
