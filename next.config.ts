import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/artikel", destination: "/articles", permanent: true },
      {
        source: "/artikel/:slug",
        destination: "/articles/:slug",
        permanent: true,
      },
      { source: "/kajian", destination: "/articles", permanent: true },
      {
        source: "/kajian/:slug",
        destination: "/articles/:slug",
        permanent: true,
      },
      {
        source: "/kategori/:slug",
        destination: "/articles?category=:slug",
        permanent: true,
      },
    ];
  },
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
      {
        source: "/dashboard/notifications",
        destination: "/notifications",
      },
      {
        source: "/dashboard/notifications/settings",
        destination: "/notifications/settings",
      },
    ];
  },
};

export default withNextIntl(nextConfig);
