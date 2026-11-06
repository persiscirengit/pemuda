import { Shield } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";

export async function PublicHeader() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  const t = await getTranslations("publicNav");

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/95 backdrop-blur-xs supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <Shield className="h-5 w-5" />
          </div>
          <span className="font-bold tracking-tight text-foreground text-sm sm:text-base">
            {t("organization")}
          </span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">{t("home")}</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/articles">{t("articles")}</Link>
          </Button>

          {session?.user ? (
            <Button size="sm" asChild>
              <Link href="/dashboard">{t("dashboard")}</Link>
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link href="/login">{t("login")}</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
