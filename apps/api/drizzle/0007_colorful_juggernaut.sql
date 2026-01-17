-- Create username_history table
CREATE TABLE "username_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"old_username" text NOT NULL,
	"new_username" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Add username column as nullable first
ALTER TABLE "users" ADD COLUMN "username" text;
--> statement-breakpoint

-- Add username_changed_at column
ALTER TABLE "users" ADD COLUMN "username_changed_at" timestamp with time zone;
--> statement-breakpoint

-- Populate existing users with temporary usernames (user_<id>)
UPDATE "users" SET "username" = 'user_' || "id"::text WHERE "username" IS NULL;
--> statement-breakpoint

-- Now make username NOT NULL
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;
--> statement-breakpoint

-- Add foreign key for username_history
ALTER TABLE "username_history" ADD CONSTRAINT "username_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Create indexes
CREATE INDEX "username_history_user_id_idx" ON "username_history" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "username_history_changed_at_idx" ON "username_history" USING btree ("changed_at");
--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");
--> statement-breakpoint

-- Add unique constraint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");
