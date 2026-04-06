import { createProjectAction } from "@/modules/projects/actions";

export default function NewProjectPage() {
  return (
    <main className="container">
      <h1>New Project</h1>
      <p className="subtitle">Create and save a project (generation is not implemented yet).</p>

      <form action={createProjectAction} className="grid" style={{ maxWidth: 700 }}>
        <label className="card">
          <strong>Project name</strong>
          <input name="name" placeholder="The Last Broadcast" required style={{ width: "100%", marginTop: 8 }} />
        </label>
        <label className="card">
          <strong>Theme / premise</strong>
          <textarea
            name="premise"
            placeholder="A one-sentence idea or detailed prompt"
            rows={4}
            required
            style={{ width: "100%", marginTop: 8 }}
          />
        </label>
        <button type="submit" className="card" style={{ cursor: "pointer", width: 220 }}>
          Save Project
        </button>
      </form>
    </main>
  );
}
