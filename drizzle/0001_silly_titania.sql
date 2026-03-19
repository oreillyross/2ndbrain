ALTER TABLE "notes" ALTER COLUMN "search_vector" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "title" text NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_title_unique" UNIQUE("title");