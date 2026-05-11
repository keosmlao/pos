/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['10.0.20.180'],
  serverExternalPackages: ['pg'],
};

module.exports = nextConfig;
