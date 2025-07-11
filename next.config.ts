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
    // Only apply this configuration for the server build in production
    if (isServer && !dev) {
      const workerPath = path.join(__dirname, 'src/workers/image-converter-worker.ts');
      
      // Add the worker as a separate entry point
      config.entry = () =>
        config.entry().then((entry: any) => {
          entry['workers/image-converter-worker'] = workerPath;
          return entry;
        });

      // Configure the output for the worker
      config.output = {
        ...config.output,
        // The default is `[name].js` which we want to override for workers.
        filename: (pathData: any) => {
          // Output workers to their own subdirectory
          if (pathData.chunk.name.startsWith('workers/')) {
            return '[name].js';
          }
          // The default Next.js server entry point.
          return 'server.js';
        },
        // This is necessary to prevent a crash when the server starts.
        globalObject: 'this',
      };
    }
    return config;
  },
};

export default nextConfig;
