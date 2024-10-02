/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    experimental: {
        runtime: 'nodejs',
        serverActions: true,
        serverComponentsExternalPackages: ['@prisma/client', '@prisma/client/edge'],
    },
};

export default nextConfig;
