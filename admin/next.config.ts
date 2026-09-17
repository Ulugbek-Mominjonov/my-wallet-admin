import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // `@byudjet/calc` — lokal TS paket; Next uni o'zi transpil qiladi.
  transpilePackages: ['@byudjet/calc'],
  experimental: {
    // Server Action'lar orqali kelgan katta import fayllari uchun.
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default config;
