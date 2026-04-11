import type { Metadata } from "next";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Story Video Studio",
  description: "YouTube slideshow-style story video builder",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  return (
    <html lang="en">
      <body>
        <header className="container" style={{ paddingBottom: 0 }}>
          <div
            style={{
              display: "flex",
              gap: "1rem",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
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

            {session?.user ? (
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                {session.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt={session.user.name ?? "Signed-in user avatar"}
                    width={32}
                    height={32}
                    style={{ borderRadius: "999px" }}
                  />
                ) : null}
                <span className="subtitle">{session.user.name ?? session.user.email ?? "Signed in"}</span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <button type="submit">Sign out</button>
                </form>
              </div>
            ) : (
              <Link href="/api/auth/signin/github?callbackUrl=/projects">Sign in with GitHub</Link>
            )}
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
