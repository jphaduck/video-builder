export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const loadServerStartup = new Function(
    'return import("./server-startup")',
  ) as () => Promise<typeof import("./server-startup")>;
  const { runServerStartup } = await loadServerStartup();
  await runServerStartup();
}
