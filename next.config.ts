import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Genera un servidor autónomo y ligero para la imagen Docker.
  output: "standalone",
};

export default nextConfig;
