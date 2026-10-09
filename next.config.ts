import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: { bodySizeLimit: "12mb" }, // location photos
  },
};

export default nextConfig;
