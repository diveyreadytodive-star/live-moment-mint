/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@momento/shared'],
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    // Fix @noble/hashes version conflict from @metaplex-foundation/mpl-core
    config.resolve.alias = {
      ...config.resolve.alias,
      '@noble/hashes/sha3': require.resolve('@noble/hashes/sha3'),
    };
    return config;
  },
};

module.exports = nextConfig;
