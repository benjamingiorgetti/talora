/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { externalDir: true },
  ...(process.env.NODE_ENV === 'production' && { output: 'export' }),
};

module.exports = nextConfig;
