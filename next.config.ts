import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Standalone output produces a minimal server bundle for the Docker image.
  output: "standalone",
  poweredByHeader: false,
  // Private uploads are runtime data and must never be copied into the server bundle.
  outputFileTracingExcludes: { "/*": ["uploads/**", "test-results/**", "playwright-report/**"] },
  experimental: {
    // Sample photos, QC photos and documents are posted through server actions (10 MB per file).
    serverActions: { bodySizeLimit: "25mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
