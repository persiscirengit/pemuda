CREATE TYPE "public"."activity_status" AS ENUM('scheduled', 'completed', 'holiday', 'postponed', 'relocated', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."attendance_method" AS ENUM('qr', 'link', 'manual');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('present', 'permission', 'absent', 'need_verification');--> statement-breakpoint
CREATE TYPE "public"."attendance_verification_status" AS ENUM('valid', 'need_verification', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."schedule_type" AS ENUM('incidental', 'weekly', 'monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."article_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."financial_category_type" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."member_fee_status" AS ENUM('unpaid', 'paid', 'waived');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'transfer', 'other');--> statement-breakpoint
CREATE TYPE "public"."broadcast_channel" AS ENUM('in_app', 'push', 'both');--> statement-breakpoint
CREATE TYPE "public"."broadcast_status" AS ENUM('draft', 'sent', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."broadcast_target_type" AS ENUM('all_members', 'active_members', 'by_department', 'by_position', 'selected_members');--> statement-breakpoint
CREATE TYPE "public"."department_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."inactive_reason" AS ENUM('rarely_active', 'resigned', 'age_limit', 'transferred_to_persis', 'moved_domicile', 'other');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('active', 'inactive', 'alumni', 'moved');--> statement-breakpoint
CREATE TYPE "public"."position_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agenda_schedule_id" uuid,
	"department_id" uuid,
	"pic_id" uuid,
	"title" varchar(200) NOT NULL,
	"topic" varchar(255),
	"description" text,
	"activity_date" date NOT NULL,
	"start_time" time,
	"end_time" time,
	"location" varchar(255),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"attendance_radius" integer DEFAULT 100 NOT NULL,
	"status" "activity_status" DEFAULT 'scheduled' NOT NULL,
	"change_reason" text,
	"attendance_enabled" boolean DEFAULT false NOT NULL,
	"attendance_open_at" timestamp with time zone,
	"attendance_close_at" timestamp with time zone,
	"attendance_token" varchar(64),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activities_attendance_token_unique" UNIQUE("attendance_token")
);
--> statement-breakpoint
CREATE TABLE "activity_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"address" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"radius_meters" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agenda_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid,
	"pic_id" uuid,
	"activity_location_id" uuid,
	"title" varchar(200) NOT NULL,
	"description" text,
	"schedule_type" "schedule_type" NOT NULL,
	"day_of_week" smallint,
	"day_of_month" smallint,
	"specific_date" date,
	"start_time" time,
	"end_time" time,
	"default_location" varchar(255),
	"default_latitude" numeric(10, 7),
	"default_longitude" numeric(10, 7),
	"default_radius" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agenda_weekly_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agenda_schedule_id" uuid NOT NULL,
	"week_number" smallint NOT NULL,
	"topic" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agenda_weekly_topics_schedule_week_unique" UNIQUE("agenda_schedule_id","week_number")
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"status" "attendance_status" DEFAULT 'present' NOT NULL,
	"attendance_method" "attendance_method" DEFAULT 'manual' NOT NULL,
	"checked_in_at" timestamp with time zone,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"distance_from_activity" numeric(10, 2),
	"location_accuracy" numeric(10, 2),
	"verification_status" "attendance_verification_status" DEFAULT 'valid' NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_records_activity_member_unique" UNIQUE("activity_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "article_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"description" text,
	"color" varchar(30),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_category_id" uuid,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"excerpt" text,
	"content" text,
	"banner_image" varchar(255),
	"youtube_url" varchar(255),
	"status" "article_status" DEFAULT 'draft' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"views_count" bigint DEFAULT 0 NOT NULL,
	"author_id" uuid,
	"department_id" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "financial_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"type" "financial_category_type" NOT NULL,
	"description" text,
	"color" varchar(30),
	"icon" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "financial_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "financial_category_type" NOT NULL,
	"financial_category_id" uuid NOT NULL,
	"amount_idr" bigint NOT NULL,
	"transaction_date" date NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"payment_method" "payment_method" DEFAULT 'cash',
	"reference_no" varchar(100),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "member_fee_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"year" smallint NOT NULL,
	"month" smallint NOT NULL,
	"amount_idr" bigint DEFAULT 0 NOT NULL,
	"status" "member_fee_status" DEFAULT 'unpaid' NOT NULL,
	"paid_at" date,
	"note" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_fee_records_member_period_unique" UNIQUE("member_id","year","month")
);
--> statement-breakpoint
CREATE TABLE "member_fee_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"amount_idr" bigint DEFAULT 0 NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_fee_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) DEFAULT 'Monthly Membership Fee' NOT NULL,
	"default_amount_idr" bigint DEFAULT 0 NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcast_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"type" varchar(50) DEFAULT 'announcement' NOT NULL,
	"target_type" "broadcast_target_type" DEFAULT 'active_members' NOT NULL,
	"target_payload" jsonb,
	"channel" "broadcast_channel" DEFAULT 'in_app' NOT NULL,
	"url" varchar(255),
	"status" "broadcast_status" DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_by" uuid,
	"target_count" integer DEFAULT 0 NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"push_attempted_count" integer DEFAULT 0 NOT NULL,
	"push_sent_count" integer DEFAULT 0 NOT NULL,
	"push_failed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"member_id" uuid,
	"category" varchar(50) NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_category_unique" UNIQUE("user_id","category")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"member_id" uuid,
	"type" varchar(50) NOT NULL,
	"related_type" varchar(50),
	"related_id" uuid,
	"dedupe_key" varchar(100),
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"url" varchar(255),
	"data" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_user_dedupe_unique" UNIQUE("user_id","dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"member_id" uuid,
	"endpoint" varchar(1024) NOT NULL,
	"public_key" text,
	"auth_token" text,
	"content_encoding" varchar(30),
	"user_agent" text,
	"device_name" varchar(100),
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"status" "department_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid,
	"position_id" uuid,
	"full_name" varchar(150) NOT NULL,
	"member_number" varchar(50),
	"phone" varchar(30),
	"email" varchar(255),
	"address" text,
	"profile_photo" varchar(255),
	"joined_at" date,
	"birth_date" date,
	"member_status" "member_status" DEFAULT 'active' NOT NULL,
	"inactive_reason" "inactive_reason",
	"inactive_at" date,
	"status_notes" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_member_number_unique" UNIQUE("member_number")
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"status" "position_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "positions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text,
	"type" varchar(30) DEFAULT 'string',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_agenda_schedule_id_agenda_schedules_id_fk" FOREIGN KEY ("agenda_schedule_id") REFERENCES "public"."agenda_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_pic_id_members_id_fk" FOREIGN KEY ("pic_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_schedules" ADD CONSTRAINT "agenda_schedules_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_schedules" ADD CONSTRAINT "agenda_schedules_pic_id_members_id_fk" FOREIGN KEY ("pic_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_schedules" ADD CONSTRAINT "agenda_schedules_activity_location_id_activity_locations_id_fk" FOREIGN KEY ("activity_location_id") REFERENCES "public"."activity_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_schedules" ADD CONSTRAINT "agenda_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_weekly_topics" ADD CONSTRAINT "agenda_weekly_topics_agenda_schedule_id_agenda_schedules_id_fk" FOREIGN KEY ("agenda_schedule_id") REFERENCES "public"."agenda_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_article_category_id_article_categories_id_fk" FOREIGN KEY ("article_category_id") REFERENCES "public"."article_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_financial_category_id_financial_categories_id_fk" FOREIGN KEY ("financial_category_id") REFERENCES "public"."financial_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_fee_records" ADD CONSTRAINT "member_fee_records_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_fee_records" ADD CONSTRAINT "member_fee_records_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_fee_settings" ADD CONSTRAINT "member_fee_settings_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_notifications" ADD CONSTRAINT "broadcast_notifications_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_date_idx" ON "activities" USING btree ("activity_date");--> statement-breakpoint
CREATE INDEX "activities_status_idx" ON "activities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "activities_schedule_idx" ON "activities" USING btree ("agenda_schedule_id");--> statement-breakpoint
CREATE INDEX "activities_department_idx" ON "activities" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "activities_pic_idx" ON "activities" USING btree ("pic_id");--> statement-breakpoint
CREATE INDEX "activities_date_status_idx" ON "activities" USING btree ("activity_date","status");--> statement-breakpoint
CREATE INDEX "activity_locations_is_active_idx" ON "activity_locations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "agenda_schedules_department_idx" ON "agenda_schedules" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "agenda_schedules_pic_idx" ON "agenda_schedules" USING btree ("pic_id");--> statement-breakpoint
CREATE INDEX "agenda_schedules_location_idx" ON "agenda_schedules" USING btree ("activity_location_id");--> statement-breakpoint
CREATE INDEX "agenda_schedules_type_idx" ON "agenda_schedules" USING btree ("schedule_type");--> statement-breakpoint
CREATE INDEX "agenda_schedules_active_idx" ON "agenda_schedules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "agenda_weekly_topics_schedule_idx" ON "agenda_weekly_topics" USING btree ("agenda_schedule_id");--> statement-breakpoint
CREATE INDEX "attendance_records_activity_idx" ON "attendance_records" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "attendance_records_member_idx" ON "attendance_records" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "attendance_records_status_idx" ON "attendance_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "attendance_records_verification_idx" ON "attendance_records" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "article_categories_active_idx" ON "article_categories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "article_categories_sort_idx" ON "article_categories" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "articles_status_idx" ON "articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "articles_featured_idx" ON "articles" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "articles_published_at_idx" ON "articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "articles_category_idx" ON "articles" USING btree ("article_category_id");--> statement-breakpoint
CREATE INDEX "articles_author_idx" ON "articles" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "articles_department_idx" ON "articles" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "articles_deleted_at_idx" ON "articles" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "financial_categories_type_active_idx" ON "financial_categories" USING btree ("type","is_active");--> statement-breakpoint
CREATE INDEX "financial_categories_sort_name_idx" ON "financial_categories" USING btree ("sort_order","name");--> statement-breakpoint
CREATE INDEX "financial_transactions_type_date_idx" ON "financial_transactions" USING btree ("type","transaction_date");--> statement-breakpoint
CREATE INDEX "financial_transactions_category_idx" ON "financial_transactions" USING btree ("financial_category_id");--> statement-breakpoint
CREATE INDEX "financial_transactions_date_idx" ON "financial_transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "financial_transactions_deleted_at_idx" ON "financial_transactions" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "member_fee_records_period_idx" ON "member_fee_records" USING btree ("year","month");--> statement-breakpoint
CREATE INDEX "member_fee_records_status_idx" ON "member_fee_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "member_fee_records_member_idx" ON "member_fee_records" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "member_fee_settings_member_idx" ON "member_fee_settings" USING btree ("member_id","is_active");--> statement-breakpoint
CREATE INDEX "member_fee_settings_period_idx" ON "member_fee_settings" USING btree ("effective_from","effective_to");--> statement-breakpoint
CREATE INDEX "membership_fee_settings_period_idx" ON "membership_fee_settings" USING btree ("is_active","effective_from","effective_to");--> statement-breakpoint
CREATE INDEX "broadcast_notifications_status_created_idx" ON "broadcast_notifications" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "broadcast_notifications_type_created_idx" ON "broadcast_notifications" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "broadcast_notifications_channel_created_idx" ON "broadcast_notifications" USING btree ("channel","created_at");--> statement-breakpoint
CREATE INDEX "notification_preferences_member_category_idx" ON "notification_preferences" USING btree ("member_id","category");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_member_read_idx" ON "notifications" USING btree ("member_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_type_created_idx" ON "notifications" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_related_idx" ON "notifications" USING btree ("user_id","type","related_type","related_id");--> statement-breakpoint
CREATE INDEX "notifications_member_related_idx" ON "notifications" USING btree ("member_id","type","related_type","related_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_revoked_idx" ON "push_subscriptions" USING btree ("user_id","revoked_at");--> statement-breakpoint
CREATE INDEX "push_subscriptions_member_revoked_idx" ON "push_subscriptions" USING btree ("member_id","revoked_at");--> statement-breakpoint
CREATE INDEX "departments_status_idx" ON "departments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "members_department_id_idx" ON "members" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "members_position_id_idx" ON "members" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "members_status_idx" ON "members" USING btree ("member_status");--> statement-breakpoint
CREATE INDEX "members_joined_at_idx" ON "members" USING btree ("joined_at");--> statement-breakpoint
CREATE INDEX "positions_status_idx" ON "positions" USING btree ("status");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;