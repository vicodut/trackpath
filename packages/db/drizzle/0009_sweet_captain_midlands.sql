CREATE TABLE "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"default_hike_id" integer,
	"mapshare_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hikes" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"start_date" text NOT NULL,
	"end_date" text,
	"trail_coords" text NOT NULL,
	"elevation_profile" text NOT NULL,
	"distance_km" double precision NOT NULL,
	"highlights" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hikes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "cheers" ADD COLUMN "hike_id" integer;--> statement-breakpoint
ALTER TABLE "gear_categories" ADD COLUMN "hike_id" integer;--> statement-breakpoint
ALTER TABLE "poll_suggestions" ADD COLUMN "hike_id" integer;--> statement-breakpoint
ALTER TABLE "polls" ADD COLUMN "hike_id" integer;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD COLUMN "hike_id" integer;--> statement-breakpoint
ALTER TABLE "tracking_points" ADD COLUMN "hike_id" integer;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_default_hike_id_hikes_id_fk" FOREIGN KEY ("default_hike_id") REFERENCES "public"."hikes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheers" ADD CONSTRAINT "cheers_hike_id_hikes_id_fk" FOREIGN KEY ("hike_id") REFERENCES "public"."hikes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gear_categories" ADD CONSTRAINT "gear_categories_hike_id_hikes_id_fk" FOREIGN KEY ("hike_id") REFERENCES "public"."hikes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_suggestions" ADD CONSTRAINT "poll_suggestions_hike_id_hikes_id_fk" FOREIGN KEY ("hike_id") REFERENCES "public"."hikes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_hike_id_hikes_id_fk" FOREIGN KEY ("hike_id") REFERENCES "public"."hikes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD CONSTRAINT "strava_activities_hike_id_hikes_id_fk" FOREIGN KEY ("hike_id") REFERENCES "public"."hikes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_points" ADD CONSTRAINT "tracking_points_hike_id_hikes_id_fk" FOREIGN KEY ("hike_id") REFERENCES "public"."hikes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tracking_hike" ON "tracking_points" USING btree ("hike_id");