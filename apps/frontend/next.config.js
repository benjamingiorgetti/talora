/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: { externalDir: true },
  transpilePackages: ['@talora/shared'],
};

module.exports = nextConfig;
