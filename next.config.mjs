/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@prisma/client"],
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "*.microsoft.com" },
      { protocol: "https", hostname: "*.microsoftonline.com" },
    ],
  },
};

export default nextConfig;
