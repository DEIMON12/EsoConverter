import type {NextConfig} from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer, dev }) => {
    // This is the correct configuration to handle worker threads in Next.js
    if (isServer) {
        const entry = config.entry as () => Promise<Record<string, string[] | string>>;
        config.entry = async () => {
            const entries = await entry();
            const workerPath = path.resolve(process.cwd(), 'src/workers/image-converter-worker.ts');
            // This ensures the worker is compiled as a separate chunk.
            entries['workers/image-converter-worker'] = workerPath;
            return entries;
        };
    }
    return config;
  },
};

export default nextConfig;
