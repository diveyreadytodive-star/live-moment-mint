/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@momento/shared'],
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
