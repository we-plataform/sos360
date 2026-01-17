/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@sos360/shared'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig;
