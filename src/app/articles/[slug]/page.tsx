import { ArrowLeft, Calendar, Clock, Eye, User } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import sanitizeHtml from "sanitize-html";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PublicFooter } from "@/features/public/components/public-footer";
import { PublicHeader } from "@/features/public/components/public-header";
import { calculateReadingTimeMinutes } from "@/lib/reading-time";
import { getYouTubeEmbedUrl } from "@/lib/youtube";
import { sanitizeArticleContent } from "@/server/dal/content/articles";
import { getPublicArticleBySlug } from "@/server/dal/content/public-articles";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublicArticleBySlug(slug);

  if (!article) {
    return {
      title: "Article Not Found | Pemuda Persis Cirengit",
    };
  }

  const title = `${article.title} | Pemuda Persis Cirengit`;
  const description = article.excerpt || article.title;
  const images = article.bannerImage
    ? [
        article.bannerImage.startsWith("http")
          ? article.bannerImage
          : `/${article.bannerImage}`,
      ]
    : [];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: article.publishedAt
        ? new Date(article.publishedAt).toISOString()
        : undefined,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
  };
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [article, t] = await Promise.all([
    getPublicArticleBySlug(slug),
    getTranslations("publicArticles"),
  ]);

  if (!article) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <PublicHeader />
        <main className="flex-1 py-20">
          <div className="container mx-auto max-w-xl px-4 text-center space-y-4">
            <h1 className="text-2xl font-bold tracking-tight">
              {t("notFoundTitle")}
            </h1>
            <p className="text-muted-foreground">{t("notFoundMessage")}</p>
            <div className="pt-4">
              <Button asChild>
                <Link href="/articles">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  <span>{t("backToArticles")}</span>
                </Link>
              </Button>
            </div>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  const readingMinutes = calculateReadingTimeMinutes(article.content || "");
  const formattedDate = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString()
    : "";
  const youtubeEmbedUrl = getYouTubeEmbedUrl(article.youtubeUrl);
  const cleanHtml = sanitizeArticleContent(article.content || "");
  const safeHtml = sanitizeHtml(cleanHtml);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PublicHeader />

      <main className="flex-1 py-10 sm:py-16">
        <article className="container mx-auto max-w-4xl px-4 sm:px-6 space-y-8">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-6 -ml-3">
              <Link href="/articles">
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span>{t("backToArticles")}</span>
              </Link>
            </Button>

            <div className="space-y-4">
              {article.category && (
                <Badge variant="secondary" className="font-medium">
                  <span>{article.category.name}</span>
                </Badge>
              )}

              <h1 className="font-extrabold tracking-tight text-3xl sm:text-4xl lg:text-5xl text-foreground leading-tight">
                {article.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground border-b border-border/40 pb-6 pt-2">
                {article.authorName && (
                  <div className="flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    <span>
                      {t("writtenBy", { author: article.authorName })}
                    </span>
                  </div>
                )}
                {formattedDate && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span>{t("publishedOn", { date: formattedDate })}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>{t("readingTime", { minutes: readingMinutes })}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Eye className="h-4 w-4" />
                  <span>{t("views", { count: article.viewsCount })}</span>
                </div>
              </div>
            </div>
          </div>

          {article.bannerImage && (
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border/60 bg-muted">
              <Image
                src={
                  article.bannerImage.startsWith("http")
                    ? article.bannerImage
                    : `/${article.bannerImage}`
                }
                alt={article.title}
                fill
                priority
                className="object-cover"
              />
            </div>
          )}

          {youtubeEmbedUrl && (
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-border/60 shadow-xs">
              <iframe
                src={youtubeEmbedUrl}
                title={t("videoEmbedTitle")}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          <div
            className="prose prose-neutral dark:prose-invert max-w-none text-base sm:text-lg leading-relaxed pt-2"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Sanitized with sanitizeHtml
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />

          <div className="border-t border-border/40 pt-8 mt-12">
            <Button variant="outline" asChild>
              <Link href="/articles">
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span>{t("backToArticles")}</span>
              </Link>
            </Button>
          </div>
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}
