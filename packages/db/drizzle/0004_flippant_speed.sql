CREATE TABLE "poll_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"options" text NOT NULL,
	"ip_address" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
