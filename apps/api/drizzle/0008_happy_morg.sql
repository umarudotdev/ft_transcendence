CREATE TABLE "game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" text DEFAULT 'ranked' NOT NULL,
	"state" text DEFAULT 'waiting' NOT NULL,
	"room_id" text,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "matchmaking_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"mode" text DEFAULT 'ranked' NOT NULL,
	"rating" integer NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matchmaking_queue_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "game_type" SET DEFAULT 'bullet_hell';--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "matchmaking_queue" ADD CONSTRAINT "matchmaking_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_sessions_state_idx" ON "game_sessions" USING btree ("state");--> statement-breakpoint
CREATE INDEX "game_sessions_room_id_idx" ON "game_sessions" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "game_sessions_created_at_idx" ON "game_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "matchmaking_queue_user_id_idx" ON "matchmaking_queue" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE set null ON UPDATE no action;