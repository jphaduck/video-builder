import path from "node:path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const RENDERING_DIR = path.join(DATA_DIR, "rendering");
export const RENDERS_DIR = path.join(DATA_DIR, "renders");

export function resolveRenderOutputPath(outputFilePath: string): string | null {
  const absoluteOutputPath = path.resolve(process.cwd(), outputFilePath);

  if (!absoluteOutputPath.startsWith(`${RENDERS_DIR}${path.sep}`)) {
    return null;
  }

  return absoluteOutputPath;
}
