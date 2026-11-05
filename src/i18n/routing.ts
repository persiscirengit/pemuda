import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["id-ID", "en-US"],
  defaultLocale: "id-ID",
  localePrefix: "never",
});

export type Locale = (typeof routing.locales)[number];
