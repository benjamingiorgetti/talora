/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@bottoo/shared'],
};

module.exports = nextConfig;
