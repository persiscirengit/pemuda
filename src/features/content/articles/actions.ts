"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { optimizeImage } from "@/lib/image";
import { PERMISSIONS } from "@/lib/permissions";
import { createPermissionActionClient } from "@/lib/safe-action";
import { generateStorageKey, storage } from "@/lib/storage";
import {
  createArticle,
  deleteArticle,
  publishArticle,
  updateArticle,
} from "@/server/dal/content/articles";

const createArticleClient = createPermissionActionClient(
  PERMISSIONS.CONTENT_ARTICLES_CREATE,
);

const updateArticleClient = createPermissionActionClient(
  PERMISSIONS.CONTENT_ARTICLES_UPDATE,
);

const deleteArticleClient = createPermissionActionClient(
  PERMISSIONS.CONTENT_ARTICLES_DELETE,
);

const publishArticleClient = createPermissionActionClient(
  PERMISSIONS.CONTENT_ARTICLES_PUBLISH,
);

const createArticleSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }).max(255),
  slug: z.string().max(255).optional(),
  excerpt: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  bannerImage: z.string().optional().nullable(),
  bannerImageBase64: z.string().optional().nullable(),
  youtubeUrl: z.string().max(255).optional().nullable(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  isFeatured: z.boolean().default(false),
  articleCategoryId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  publishedAt: z.string().optional().nullable(),
});

const updateArticleSchema = z.object({
  id: z.string().uuid(),
  title: z
    .string()
    .min(1, { message: "Title is required" })
    .max(255)
    .optional(),
  slug: z.string().max(255).optional(),
  excerpt: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  bannerImage: z.string().optional().nullable(),
  bannerImageBase64: z.string().optional().nullable(),
  youtubeUrl: z.string().max(255).optional().nullable(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  isFeatured: z.boolean().optional(),
  articleCategoryId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  publishedAt: z.string().optional().nullable(),
});

const articleIdSchema = z.object({
  id: z.string().uuid(),
});

const uploadImageSchema = z.object({
  imageBase64: z.string().min(1, { message: "Image base64 data is required" }),
});

export const createArticleAction = createArticleClient
  .inputSchema(createArticleSchema)
  .action(async ({ parsedInput, ctx }) => {
    let bannerKey = parsedInput.bannerImage ?? null;

    if (parsedInput.bannerImageBase64) {
      const base64Content = parsedInput.bannerImageBase64.replace(
        /^data:image\/[a-zA-Z+]+;base64,/,
        "",
      );
      const buffer = Buffer.from(base64Content, "base64");
      const optimized = await optimizeImage(buffer, {
        maxWidth: 1600,
        maxHeight: 1200,
        quality: 85,
      });

      bannerKey = generateStorageKey("articles");
      await storage.upload(bannerKey, optimized.buffer, "image/webp");
    }

    const created = await createArticle(
      {
        title: parsedInput.title,
        slug: parsedInput.slug,
        excerpt: parsedInput.excerpt,
        content: parsedInput.content,
        bannerImage: bannerKey,
        youtubeUrl: parsedInput.youtubeUrl,
        status: parsedInput.status,
        isFeatured: parsedInput.isFeatured,
        articleCategoryId: parsedInput.articleCategoryId,
        departmentId: parsedInput.departmentId,
        authorId: ctx.user.id,
        publishedAt: parsedInput.publishedAt
          ? new Date(parsedInput.publishedAt)
          : null,
      },
      {
        session: ctx.session,
        user: ctx.user,
      },
    );

    revalidatePath("/articles");
    revalidatePath("/dashboard/articles");
    revalidatePath("/");

    return { success: true, article: created };
  });

export const updateArticleAction = updateArticleClient
  .inputSchema(updateArticleSchema)
  .action(async ({ parsedInput, ctx }) => {
    let bannerKey = parsedInput.bannerImage;

    if (parsedInput.bannerImageBase64) {
      const base64Content = parsedInput.bannerImageBase64.replace(
        /^data:image\/[a-zA-Z+]+;base64,/,
        "",
      );
      const buffer = Buffer.from(base64Content, "base64");
      const optimized = await optimizeImage(buffer, {
        maxWidth: 1600,
        maxHeight: 1200,
        quality: 85,
      });

      bannerKey = generateStorageKey("articles");
      await storage.upload(bannerKey, optimized.buffer, "image/webp");
    }

    const { id, bannerImageBase64: _, ...rest } = parsedInput;

    const updated = await updateArticle(
      id,
      {
        ...rest,
        bannerImage: bannerKey,
        publishedAt: rest.publishedAt ? new Date(rest.publishedAt) : undefined,
      },
      {
        session: ctx.session,
        user: ctx.user,
      },
    );

    revalidatePath("/articles");
    revalidatePath("/dashboard/articles");
    revalidatePath(`/dashboard/articles/${id}/edit`);
    revalidatePath("/");

    return { success: true, article: updated };
  });

export const deleteArticleAction = deleteArticleClient
  .inputSchema(articleIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const deleted = await deleteArticle(parsedInput.id, {
      session: ctx.session,
      user: ctx.user,
    });

    revalidatePath("/articles");
    revalidatePath("/dashboard/articles");
    revalidatePath("/");

    return { success: true, article: deleted };
  });

export const publishArticleAction = publishArticleClient
  .inputSchema(articleIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const published = await publishArticle(parsedInput.id, {
      session: ctx.session,
      user: ctx.user,
    });

    revalidatePath("/articles");
    revalidatePath("/dashboard/articles");
    revalidatePath("/");

    return { success: true, article: published };
  });

export const uploadArticleEditorImageAction = createArticleClient
  .inputSchema(uploadImageSchema)
  .action(async ({ parsedInput }) => {
    const base64Content = parsedInput.imageBase64.replace(
      /^data:image\/[a-zA-Z+]+;base64,/,
      "",
    );
    const buffer = Buffer.from(base64Content, "base64");
    const optimized = await optimizeImage(buffer, {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 85,
    });

    const key = generateStorageKey("editor");
    await storage.upload(key, optimized.buffer, "image/webp");
    const url = storage.getUrl(key);

    return { success: true, url, key };
  });
