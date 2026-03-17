CREATE TABLE "notes" (
	"id" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
