/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['10.0.20.180'],
  serverExternalPackages: ['pg'],
  env: {
    NEXT_PUBLIC_APP_VERSION: require('./package.json').version,
  },
};

module.exports = nextConfig;
