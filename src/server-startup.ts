import "server-only";

import { runMigration } from "@/lib/db";
import { startRenderWorker } from "@/modules/rendering/worker";

export async function runServerStartup() {
  await runMigration();
  startRenderWorker();
}
