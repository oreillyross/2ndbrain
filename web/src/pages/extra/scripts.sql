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