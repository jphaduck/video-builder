import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container">
      <h1>Build YouTube Story Videos with a Structured Workflow</h1>
      <p className="subtitle">
        Story Video Studio now supports project creation plus versioned script generation, editing, comparison, and approval.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
        <Link href="/projects" className="card">
          View Projects
        </Link>
        <Link href="/projects/new" className="card">
          Create New Project
        </Link>
      </div>
    </main>
  );
}
