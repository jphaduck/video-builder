import { auth } from "@/auth";
import { jsonError } from "@/app/api/_utils";

export async function requireProjectRouteAuth() {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      userId: null,
      session: null,
      response: jsonError("Authentication required.", 401),
    };
  }

  return {
    userId: session.user.id,
    session,
    response: null,
  };
}
