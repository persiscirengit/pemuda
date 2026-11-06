import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/dashboard/check-in",
        destination: "/check-in",
      },
      {
        source: "/dashboard/my-fees",
        destination: "/my-fees",
      },
      {
        source: "/dashboard/my-profile",
        destination: "/my-profile",
      },
    ];
  },
};

export default withNextIntl(nextConfig);
