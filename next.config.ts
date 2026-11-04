import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  // Sitio estático en out/: no hay servidor. Lo usa la app de escritorio y
  // también se puede abrir en cualquier navegador o hosting estático.
  output: 'export',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
