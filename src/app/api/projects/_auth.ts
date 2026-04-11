import { auth } from "@/auth";
import { jsonError } from "@/app/api/_utils";

export async function requireProjectRouteAuth() {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      session: null,
      response: jsonError("Authentication required.", 401),
    };
  }

  return {
    session,
    response: null,
  };
}
