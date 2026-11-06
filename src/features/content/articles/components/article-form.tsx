"use client";

import { ImageIcon, Loader2, Video } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Article, ArticleCategory } from "@/db/schema/content";
import { generateSlug } from "@/lib/slug";
import { createArticleAction, updateArticleAction } from "../actions";
import { ArticleEditor } from "./article-editor";

export interface ArticleFormProps {
  initialData?: Article | null;
  categories: ArticleCategory[];
  departments: { id: string; name: string }[];
}

export function ArticleForm({
  initialData,
  categories,
  departments,
}: ArticleFormProps) {
  const t = useTranslations("articles");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const isEditing = !!initialData?.id;

  const [title, setTitle] = React.useState(initialData?.title || "");
  const [slug, setSlug] = React.useState(initialData?.slug || "");
  const [slugManuallyEdited, setSlugManuallyEdited] = React.useState(
    !!initialData?.slug,
  );
  const [excerpt, setExcerpt] = React.useState(initialData?.excerpt || "");
  const [content, setContent] = React.useState(initialData?.content || "");
  const [categoryId, setCategoryId] = React.useState<string>(
    initialData?.articleCategoryId || "none",
  );
  const [departmentId, setDepartmentId] = React.useState<string>(
    initialData?.departmentId || "none",
  );
  const [status, setStatus] = React.useState<
    "draft" | "published" | "archived"
  >(initialData?.status || "draft");
  const [isFeatured, setIsFeatured] = React.useState(
    initialData?.isFeatured ?? false,
  );
  const [youtubeUrl, setYoutubeUrl] = React.useState(
    initialData?.youtubeUrl || "",
  );

  const [bannerPreview, setBannerPreview] = React.useState<string | null>(
    initialData?.bannerImage
      ? initialData.bannerImage.startsWith("http")
        ? initialData.bannerImage
        : `/${initialData.bannerImage}`
      : null,
  );
  const [bannerBase64, setBannerBase64] = React.useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (!slugManuallyEdited) {
      setSlug(generateSlug(newTitle));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugManuallyEdited(true);
    setSlug(generateSlug(e.target.value));
  };

  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setBannerPreview(result);
      setBannerBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error(t("articleTitle"));
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && initialData) {
        const res = await updateArticleAction({
          id: initialData.id,
          title: title.trim(),
          slug: slug.trim() || generateSlug(title),
          excerpt: excerpt.trim() || null,
          content: content || null,
          bannerImageBase64: bannerBase64 || undefined,
          youtubeUrl: youtubeUrl.trim() || null,
          status,
          isFeatured,
          articleCategoryId: categoryId === "none" ? null : categoryId,
          departmentId: departmentId === "none" ? null : departmentId,
        });

        if (res?.data?.success) {
          toast.success(t("articleUpdatedSuccess"));
          router.push("/dashboard/articles");
          router.refresh();
        } else if (res?.serverError) {
          toast.error(res.serverError);
        }
      } else {
        const res = await createArticleAction({
          title: title.trim(),
          slug: slug.trim() || generateSlug(title),
          excerpt: excerpt.trim() || null,
          content: content || null,
          bannerImageBase64: bannerBase64 || undefined,
          youtubeUrl: youtubeUrl.trim() || null,
          status,
          isFeatured,
          articleCategoryId: categoryId === "none" ? null : categoryId,
          departmentId: departmentId === "none" ? null : departmentId,
        });

        if (res?.data?.success) {
          toast.success(t("articleCreatedSuccess"));
          router.push("/dashboard/articles");
          router.refresh();
        } else if (res?.serverError) {
          toast.error(res.serverError);
        }
      }
    } catch {
      toast.error(tCommon("errors.unexpected"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Editor Column (2 spans) */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("formTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="article-title">{t("articleTitle")}</Label>
                <Input
                  id="article-title"
                  value={title}
                  onChange={handleTitleChange}
                  placeholder={t("titlePlaceholder")}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="article-slug">{t("slugLabel")}</Label>
                <Input
                  id="article-slug"
                  value={slug}
                  onChange={handleSlugChange}
                  placeholder={t("slugPlaceholder")}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="article-excerpt">{t("excerptLabel")}</Label>
                <Textarea
                  id="article-excerpt"
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder={t("excerptPlaceholder")}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("contentLabel")}</Label>
                <ArticleEditor
                  value={content}
                  onChange={setContent}
                  placeholder={t("editorPlaceholder")}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Settings Column (1 span) */}
        <div className="space-y-6">
          {/* Publishing Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("statusLabel")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("statusLabel")}</Label>
                <Select
                  value={status}
                  onValueChange={(val) =>
                    setStatus(val as "draft" | "published" | "archived")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t("statuses.draft")}</SelectItem>
                    <SelectItem value="published">
                      {t("statuses.published")}
                    </SelectItem>
                    <SelectItem value="archived">
                      {t("statuses.archived")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("categoryLabel")}</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("selectCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("noCategory")}</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("departmentLabel")}</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("selectDepartment")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("noDepartment")}</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Input
                  type="checkbox"
                  id="is-featured"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                  aria-label={t("featuredLabel")}
                />
                <Label htmlFor="is-featured" className="cursor-pointer">
                  {t("featuredLabel")}
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Media & Banner */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("bannerLabel")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {bannerPreview ? (
                <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border bg-muted">
                  <Image
                    src={bannerPreview}
                    alt={title || "Banner"}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex aspect-video w-full flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-muted-foreground">
                  <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                  <span className="text-xs">{t("bannerHelp")}</span>
                </div>
              )}

              <div>
                <Label
                  htmlFor="banner-upload"
                  className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-9 px-4 w-full"
                >
                  {bannerPreview ? t("changeBanner") : t("uploadBanner")}
                </Label>
                <Input
                  id="banner-upload"
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleBannerFileChange}
                  className="hidden"
                  aria-label={t("bannerLabel")}
                />
              </div>

              <div className="space-y-2 pt-2">
                <Label
                  htmlFor="youtube-url"
                  className="flex items-center gap-1.5"
                >
                  <Video className="h-4 w-4" />
                  <span>{t("youtubeUrlLabel")}</span>
                </Label>
                <Input
                  id="youtube-url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder={t("youtubeUrlPlaceholder")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" asChild disabled={isSubmitting}>
              <Link href="/dashboard/articles">
                {tCommon("actions.cancel")}
              </Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {tCommon("actions.save")}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
