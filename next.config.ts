import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: [
    "unelected-haven-alongside.ngrok-free.dev",
    "*.ngrok-free.dev",
    "localhost:3000",
    "127.0.0.1:3000",
  ],
};

export default nextConfig;
