ALTER TABLE notes
DROP COLUMN search_vector;

ALTER TABLE notes
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
) STORED;

CREATE INDEX notes_search_idx
ON notes
USING GIN (search_vector);

ALTER TABLE notes ADD COLUMN theme_id uuid;
ALTER TABLE notes
ADD CONSTRAINT notes_theme_id_fkey
FOREIGN KEY (theme_id)
REFERENCES themes(id)
ON DELETE SET NULL;