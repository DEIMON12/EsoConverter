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
  webpack: (config, { isServer }) => {
    // This is the correct configuration to handle worker threads in Next.js
    if (isServer) {
        const entry = config.entry as () => Promise<Record<string, string[] | string>>;
        config.entry = () => {
            return entry().then((entries) => {
                entries['workers/image-converter-worker'] = path.resolve(process.cwd(), 'src/workers/image-converter-worker.ts');
                return entries;
            });
        };
    }
    return config;
  },
};

export default nextConfig;
