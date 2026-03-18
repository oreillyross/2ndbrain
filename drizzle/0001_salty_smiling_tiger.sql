CREATE TABLE "links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_note_id" uuid NOT NULL,
	"to_note_id" uuid,
	"to_title" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint


ALTER TABLE notes ADD COLUMN search_vector tsvector;

UPDATE notes
SET search_vector = to_tsvector('english', coalesce(content, ''));

CREATE FUNCTION notes_search_vector_update() RETURNS trigger AS $$
BEGIN
	NEW.search_vector :=
		to_tsvector('english', coalesce(NEW.content, ''));
	RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvectorupdate
BEFORE INSERT OR UPDATE ON notes
FOR EACH ROW EXECUTE FUNCTION notes_search_vector_update();

CREATE INDEX notes_search_idx
ON notes USING GIN (search_vector);