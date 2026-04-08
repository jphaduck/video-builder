import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { ProjectDeleteButton } from "@/components/project-delete-button";
import { listProjects } from "@/modules/projects/repository";

export default async function ProjectsListPage() {
  noStore();
  const projects = await listProjects();

  return (
    <main className="container">
      <h1>Projects</h1>
      <p className="subtitle">Saved projects from local persistence storage.</p>

      <div className="grid" style={{ marginTop: "1rem" }}>
        {projects.length === 0 ? (
          <div className="card">
            <p className="subtitle">No projects yet. Create one to get started.</p>
            <Link href="/projects/new">Go to New Project</Link>
          </div>
        ) : (
          projects.map((project) => (
            <article key={project.id} className="card">
              <h3 style={{ marginTop: 0 }}>{project.name}</h3>
              <p className="subtitle" style={{ marginBottom: 6 }}>
                Status: {project.status}
              </p>
              <p className="subtitle" style={{ marginBottom: 8 }}>
                Updated: {new Date(project.updatedAt).toLocaleString()}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link href={`/projects/${project.id}`} className="card">
                  Open project
                </Link>
                <ProjectDeleteButton projectId={project.id} projectName={project.name} />
              </div>
            </article>
          ))
        )}
      </div>
    </main>
  );
}
