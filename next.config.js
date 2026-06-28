/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [{ source: '/', destination: '/app.html' }];
  },
};

module.exports = nextConfig;
