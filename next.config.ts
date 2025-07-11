import type {NextConfig} from 'next';

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
    if (isServer) {
      config.module.rules.push({
        test: /src[\\/]workers[\\/].+\.ts$/,
        loader: 'ts-loader',
        options: {
          transpileOnly: true,
        },
      });

      // This is necessary to ensure the worker files are outputted to the correct directory
      // when the server is built.
      config.output.globalObject = 'this';
    }
    return config;
  },
};

export default nextConfig;
