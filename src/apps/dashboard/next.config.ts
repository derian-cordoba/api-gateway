import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["better-sqlite3", "pg", "mongodb", "typeorm"],
  reactStrictMode: true,
};

export default nextConfig;
