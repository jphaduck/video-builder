import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { ProjectShell } from "@/components/project-shell";
import { getProjectById } from "@/modules/projects/repository";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  noStore();
  const { projectId } = await params;
  const project = await getProjectById(projectId);

  if (!project) {
    notFound();
  }

  return (
    <main className="container">
      <h1>{project.name}</h1>
      <p className="subtitle" style={{ marginBottom: 6 }}>
        Project ID: {project.id}
      </p>
      <p className="subtitle" style={{ marginBottom: 6 }}>
        Status: {project.status}
      </p>
      <p className="subtitle" style={{ marginBottom: 16 }}>
        Premise: {project.storyInput.premise}
      </p>
      <ProjectShell />
    </main>
  );
}
