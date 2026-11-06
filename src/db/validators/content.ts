import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { articleCategories, articles } from "@/db/schema/content";

export const insertArticleCategorySchema =
  createInsertSchema(articleCategories);
export const selectArticleCategorySchema =
  createSelectSchema(articleCategories);

export const insertArticleSchema = createInsertSchema(articles);
export const selectArticleSchema = createSelectSchema(articles);
