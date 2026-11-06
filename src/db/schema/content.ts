import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { users } from "./auth";
import { departments } from "./organization";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const articleStatusEnum = pgEnum("article_status", [
  "draft",
  "published",
  "archived",
]);

// -----------------------------------------------------------------------------
// Tables
// -----------------------------------------------------------------------------

export const articleCategories = pgTable(
  "article_categories",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    description: text("description"),
    color: varchar("color", { length: 30 }),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("article_categories_active_idx").on(t.isActive),
    index("article_categories_sort_idx").on(t.sortOrder),
  ],
);

export const articles = pgTable(
  "articles",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    articleCategoryId: uuid("article_category_id").references(
      () => articleCategories.id,
      { onDelete: "set null" },
    ),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    excerpt: text("excerpt"),
    content: text("content"), // Sanitized TipTap HTML with RTL .arabic container support
    bannerImage: varchar("banner_image", { length: 255 }), // Relative S3 key (e.g. uploads/articles/<uuid>.webp)
    youtubeUrl: varchar("youtube_url", { length: 255 }),
    status: articleStatusEnum("status").notNull().default("draft"),
    isFeatured: boolean("is_featured").notNull().default(false),
    viewsCount: bigint("views_count", { mode: "number" }).notNull().default(0),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }), // Soft delete
  },
  (t) => [
    index("articles_status_idx").on(t.status),
    index("articles_featured_idx").on(t.isFeatured),
    index("articles_published_at_idx").on(t.publishedAt),
    index("articles_category_idx").on(t.articleCategoryId),
    index("articles_author_idx").on(t.authorId),
    index("articles_department_idx").on(t.departmentId),
    index("articles_deleted_at_idx").on(t.deletedAt),
  ],
);

// -----------------------------------------------------------------------------
// Relations
// -----------------------------------------------------------------------------

export const articleCategoriesRelations = relations(
  articleCategories,
  ({ many }) => ({
    articles: many(articles),
  }),
);

export const articlesRelations = relations(articles, ({ one }) => ({
  category: one(articleCategories, {
    fields: [articles.articleCategoryId],
    references: [articleCategories.id],
  }),
  author: one(users, {
    fields: [articles.authorId],
    references: [users.id],
  }),
  department: one(departments, {
    fields: [articles.departmentId],
    references: [departments.id],
  }),
}));

// -----------------------------------------------------------------------------
// Inferred Types
// -----------------------------------------------------------------------------

export type ArticleCategory = typeof articleCategories.$inferSelect;
export type NewArticleCategory = typeof articleCategories.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
