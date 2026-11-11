const isProd = process.env.NODE_ENV === "production";

// Content Security Policy. Next.js hydration uses inline scripts, so 'unsafe-inline' is needed for scripts
// (a nonce-based policy would force every page to render dynamically and is a later hardening step).
// Nothing is loaded from other sites, and framing, plugins and form posts elsewhere are refused.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (isProd ? "" : " 'unsafe-eval'"),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["mongoose"],
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  // Lint is skipped because eslint isn't a dependency yet.
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  // Old addresses keep working (printed QR codes, saved links, e-mails already sent).
  async redirects() {
    return [
      { source: "/forgot", destination: "/forgot-password", permanent: false },
      { source: "/reset", destination: "/reset-password", permanent: false },
      { source: "/attend/:token", destination: "/attendance/:token", permanent: false },
      { source: "/me", destination: "/member", permanent: false },
      { source: "/admin/organization", destination: "/admin/organizations", permanent: false },
      { source: "/admin/assistant", destination: "/admin/ai-assistant", permanent: false },
      { source: "/admin/communications", destination: "/admin/notifications", permanent: false },
      { source: "/admin/audit", destination: "/admin/audit-logs", permanent: false },
      { source: "/admin/finance/dashboard", destination: "/admin/analytics", permanent: false },
      { source: "/admin/governance", destination: "/admin/leadership", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), interest-cohort=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Content-Security-Policy", value: csp },
          ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
        ],
      },
      // Private data is never kept by browsers or proxies. (/api/media sets its own caching: public images are cacheable, files are not.)
      { source: "/api/:path((?!media/).*)", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] },
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] },
      { source: "/portal/:path*", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] },
      { source: "/member/:path*", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] },
      { source: "/member", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};
export default nextConfig;
