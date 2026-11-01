import type { NextConfig } from "next";
import withPWAInit from "next-pwa";
import { getCustomerImportMaxBytes } from "./src/lib/customer-import-limits";
import { getNodeUploadMaxBytes } from "./src/lib/node-upload-limits";
import { getOfficialDocUploadMaxBytes } from "./src/lib/official-doc-upload-limits";
import { getBackupRestoreMaxBytes } from "./src/lib/backup-restore-limits";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_CUSTOMER_IMPORT_MAX_BYTES: String(getCustomerImportMaxBytes() ?? 0),
    NEXT_PUBLIC_NODE_UPLOAD_MAX_BYTES: String(getNodeUploadMaxBytes() ?? 0),
    NEXT_PUBLIC_OFFICIAL_DOC_UPLOAD_MAX_BYTES: String(getOfficialDocUploadMaxBytes() ?? 0),
    NEXT_PUBLIC_BACKUP_RESTORE_MAX_BYTES: String(getBackupRestoreMaxBytes() ?? 0),
  },
  experimental: {
    proxyClientMaxBodySize: "64mb",
  },
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.vietqr.io",
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.ignoreWarnings = [
        { module: /node_modules\/@prisma\/client/ }
      ];
    }
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      stream: false,
      http: false,
      https: false,
      net: false,
      tls: false,
      dns: false,
      os: false,
      zlib: false,
    };
    return config;
  },
  async redirects() {
    return [
      {
        source: '/admin.html',
        destination: '/',
        permanent: false,
      },
      {
        source: '/index.html',
        destination: '/',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
  turbopack: {} // Note: PWA plugin might have some issues with Turbopack, but we'll leave it
};

// @ts-ignore
export default withPWA(nextConfig);
