/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@momento/shared'],
  images: {
    unoptimized: true,
  },
  experimental: {
    serverComponentsExternalPackages: [
      '@metaplex-foundation/mpl-core',
      '@metaplex-foundation/umi',
      '@metaplex-foundation/umi-bundle-defaults',
    ],
  },
};

module.exports = nextConfig;
