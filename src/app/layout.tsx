import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Story Video Studio",
  description: "YouTube slideshow-style story video builder",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="container" style={{ paddingBottom: 0 }}>
          <nav style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <Link href="/" style={{ fontWeight: 700 }}>
              Story Video Studio
            </Link>
            <Link href="/projects" className="subtitle">
              Projects
            </Link>
            <Link href="/projects/new" className="subtitle">
              New Project
            </Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
