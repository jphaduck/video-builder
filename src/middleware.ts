import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const isLoggedIn = Boolean(req.auth);
  const isAuthPage = req.nextUrl.pathname.startsWith("/api/auth");
  const isHomepage = req.nextUrl.pathname === "/";

  if (!isLoggedIn && !isAuthPage && !isHomepage) {
    return NextResponse.redirect(new URL("/api/auth/signin", req.url));
  }

  return undefined;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
