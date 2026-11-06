import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function PublicFooter() {
  const t = await getTranslations("publicNav");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-muted/30 py-10">
      <div className="container mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 text-center sm:flex-row sm:text-left sm:px-6">
        <div className="space-y-1">
          <p className="font-semibold text-foreground text-sm">
            {t("organization")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("copyright", {
              year,
              organization: t("organization"),
              allRightsReserved: t("allRightsReserved"),
            })}
          </p>
        </div>

        <nav className="flex items-center gap-4 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            {t("home")}
          </Link>
          <Link href="/articles" className="hover:text-foreground">
            {t("articles")}
          </Link>
          <Link href="/login" className="hover:text-foreground">
            {t("login")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
