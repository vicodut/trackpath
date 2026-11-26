CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"hike_id" integer NOT NULL,
	"date" text NOT NULL,
	"facts" jsonb NOT NULL,
	"text" text NOT NULL,
	"fallback" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_hike_date_unique" UNIQUE("hike_id","date")
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_hike_id_hikes_id_fk" FOREIGN KEY ("hike_id") REFERENCES "public"."hikes"("id") ON DELETE cascade ON UPDATE no action;