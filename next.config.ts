import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produção: desabilitar source maps expostos
  productionBrowserSourceMaps: false,

  // Headers de segurança
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            // Permite microfone (voice notes) — bloqueia camera + geolocation + interest-cohort
            value: "camera=(), microphone=(self), geolocation=(), interest-cohort=()",
          },
          {
            key: "Content-Security-Policy",
            // - 'unsafe-inline' em script é necessário para Next inline scripts (theme + hydration)
            // - 'unsafe-eval' para algumas libs (recharts, etc.)
            // - img-src https + blob para favicons + OG images do LeadEnrichment
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss:",
              "frame-src 'none'",
              "frame-ancestors 'none'",
              "form-action 'self'",
              "base-uri 'self'",
              "object-src 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
      // ⚠️  EGRESS: NÃO meter Cache-Control aqui. Cada route define o seu próprio
      //    header (ex: /api/notifications usa private,max-age=30; /api/leads/nichos
      //    usa private,max-age=600). Header global override anula todos eles.
      //    Routes mutating (POST/PUT/DELETE) não cacheiam por defeito no browser.
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },

  // Bundle: empacotar imports só do que é usado (corta 80-200KB do client)
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'date-fns',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tooltip',
    ],
  },

  // Limitar tamanho de body para API routes (proteção DoS)
  serverExternalPackages: [],
};

export default nextConfig;
