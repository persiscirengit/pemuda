import { BookOpen, Calendar, Clock, Eye } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import type { Article } from "@/db/schema/content";
import { calculateReadingTimeMinutes } from "@/lib/reading-time";

export interface ArticleCardProps {
  article: Article;
}

export function ArticleCard({ article }: ArticleCardProps) {
  const t = useTranslations("publicArticles");
  const readingMinutes = calculateReadingTimeMinutes(article.content || "");
  const formattedDate = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString()
    : "";

  return (
    <Card className="flex h-full flex-col overflow-hidden border-border/80 transition-shadow hover:shadow-md">
      <Link
        href={`/articles/${article.slug}`}
        className="block overflow-hidden"
      >
        {article.bannerImage ? (
          <div className="relative aspect-video w-full overflow-hidden bg-muted">
            <Image
              src={
                article.bannerImage.startsWith("http")
                  ? article.bannerImage
                  : `/${article.bannerImage}`
              }
              alt={article.title}
              fill
              className="object-cover transition-transform duration-300 hover:scale-105"
            />
          </div>
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-muted/40 text-muted-foreground">
            <BookOpen className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
      </Link>

      <CardHeader className="p-5 pb-3">
        <Link
          href={`/articles/${article.slug}`}
          className="group block space-y-1.5"
        >
          <h3 className="line-clamp-2 font-bold text-foreground text-lg group-hover:text-primary transition-colors">
            {article.title}
          </h3>
        </Link>
      </CardHeader>

      <CardContent className="flex-1 px-5 py-0">
        {article.excerpt && (
          <p className="line-clamp-3 text-muted-foreground text-sm leading-relaxed">
            {article.excerpt}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-2 p-5 pt-4 text-xs text-muted-foreground border-t border-border/40 mt-4">
        <div className="flex items-center gap-3">
          {formattedDate && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>{t("publishedOn", { date: formattedDate })}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{t("readingTime", { minutes: readingMinutes })}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Eye className="h-3.5 w-3.5" />
          <span>{t("views", { count: article.viewsCount })}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
