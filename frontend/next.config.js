/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    dirs: ["app", "components", "lib"],
  },
  // Disable Next's automatic build-time Google Fonts optimization: it tries
  // to fetch fonts.googleapis.com during `next build`, which isn't reachable
  // in restricted build environments. Fonts still load fine at runtime via
  // the <link> tag in app/layout.tsx.
  optimizeFonts: false,
  webpack: (config) => {
    // @rainbow-me/rainbowkit's default wallet list pulls in a Coinbase/Base
    // Account connector, which transitively references optional x402
    // payment submodules that aren't installed and aren't used by this
    // app's ETH-tipping flow. Stub the whole dependency tree out.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@coinbase/cdp-sdk": false,
      "@base-org/account": false,
    };
    return config;
  },
};

module.exports = nextConfig;
