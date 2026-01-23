/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@lia360/shared'],
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
