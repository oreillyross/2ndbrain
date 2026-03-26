ALTER TABLE "themes" ADD COLUMN "user_id" uuid NOT NULL;

-- 1. Ensure column exists with correct type (drop + recreate safely)
DO $$
BEGIN
  -- drop if exists but wrong type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes'
      AND column_name = 'search_vector'
      AND data_type != 'tsvector'
  ) THEN
    ALTER TABLE notes DROP COLUMN search_vector;
  END IF;

  -- add if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes'
      AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE notes
    ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector(
        'english',
        coalesce(title, '') || ' ' || coalesce(content, '')
      )
    ) STORED;
  END IF;
END
$$;


-- 2. GIN index (safe)
CREATE INDEX IF NOT EXISTS notes_search_idx
ON notes
USING GIN (search_vector);


-- 3. theme_id column (safe)
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS theme_id uuid;


-- 4. foreign key (safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'notes_theme_id_fkey'
  ) THEN
    ALTER TABLE notes
    ADD CONSTRAINT notes_theme_id_fkey
    FOREIGN KEY (theme_id)
    REFERENCES themes(id)
    ON DELETE SET NULL;
  END IF;
END
$$;