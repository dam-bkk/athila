import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root — a stray lockfile in the home dir was mis-detected.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
