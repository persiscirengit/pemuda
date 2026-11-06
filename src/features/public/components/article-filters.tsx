"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { ArticleCategory } from "@/db/schema/content";

export interface ArticleFiltersProps {
  categories: ArticleCategory[];
  currentCategory?: string;
  currentSearch?: string;
}

export function ArticleFilters({
  categories,
  currentCategory,
  currentSearch = "",
}: ArticleFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const t = useTranslations("publicArticles");

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) {
      params.set("search", value.trim());
    } else {
      params.delete("search");
    }
    startTransition(() => {
      router.push(`/articles?${params.toString()}`);
    });
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("searchPlaceholder")}
          defaultValue={currentSearch}
          onChange={handleSearch}
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Badge
          variant={!currentCategory ? "default" : "outline"}
          asChild
          className="cursor-pointer"
        >
          <Link
            href={
              currentSearch
                ? `/articles?search=${encodeURIComponent(currentSearch)}`
                : "/articles"
            }
          >
            <span>{t("allCategories")}</span>
          </Link>
        </Badge>
        {categories.map((cat) => {
          const isActive = currentCategory === cat.slug;
          const href = currentSearch
            ? `/articles?category=${cat.slug}&search=${encodeURIComponent(currentSearch)}`
            : `/articles?category=${cat.slug}`;
          return (
            <Badge
              key={cat.id}
              variant={isActive ? "default" : "outline"}
              asChild
              className="cursor-pointer"
            >
              <Link href={href}>
                <span>{cat.name}</span>
              </Link>
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
