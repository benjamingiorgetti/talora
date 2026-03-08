/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@talora/shared'],
};

module.exports = nextConfig;
