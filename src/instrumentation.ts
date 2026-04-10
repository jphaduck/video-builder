export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { startRenderWorker } = await import("@/modules/rendering/worker");
  startRenderWorker();
}
