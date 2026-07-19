/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@momento/shared'],
  images: {
    unoptimized: true,
  },
  serverExternalPackages: [
    '@solana/spl-token',
    '@solana/web3.js',
    '@metaplex-foundation/mpl-core',
    '@metaplex-foundation/umi',
    '@metaplex-foundation/umi-bundle-defaults',
  ],
};

module.exports = nextConfig;
