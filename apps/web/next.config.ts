import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/validation', '@repo/shared-config'],
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
};

export default nextConfig;
