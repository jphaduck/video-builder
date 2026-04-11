import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg", "better-sqlite3", "fluent-ffmpeg", "sharp"],
};

export default nextConfig;
