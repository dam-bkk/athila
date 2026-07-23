import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for a small Docker runtime image.
  output: "standalone",
  // Pin the workspace root to the build dir. Without this, a stray
  // package-lock.json in the parent tree makes Turbopack root at the home
  // directory and scan everything — the build hangs at "Creating an
  // optimized production build". process.cwd() is the project dir locally
  // and /app inside the Docker build.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
