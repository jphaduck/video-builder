export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { runMigration } = await import("@/lib/db");
  await runMigration();

  const { startRenderWorker } = await import("@/modules/rendering/worker");
  startRenderWorker();
}
