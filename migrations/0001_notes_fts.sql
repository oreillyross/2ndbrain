-- Hand-written: FTS5 external-content index over notes(title, content),
-- keyed on notes.rid. drizzle-kit does not model virtual tables or triggers,
-- so never run `drizzle-kit push` against this database.
-- Porter stemming approximates the old Postgres 'english' config.
CREATE VIRTUAL TABLE `notes_fts` USING fts5(
	title,
	content,
	content='notes',
	content_rowid='rid',
	tokenize='porter unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `notes_fts_ai` AFTER INSERT ON `notes` BEGIN
	INSERT INTO notes_fts(rowid, title, content) VALUES (new.rid, new.title, new.content);
END;
--> statement-breakpoint
-- Deletes go by rowid via the FTS5 'delete' command (no scan).
CREATE TRIGGER `notes_fts_ad` AFTER DELETE ON `notes` BEGIN
	INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES ('delete', old.rid, old.title, old.content);
END;
--> statement-breakpoint
-- Only re-index when indexed columns change (theme assignment does not).
CREATE TRIGGER `notes_fts_au` AFTER UPDATE OF title, content ON `notes` BEGIN
	INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES ('delete', old.rid, old.title, old.content);
	INSERT INTO notes_fts(rowid, title, content) VALUES (new.rid, new.title, new.content);
END;
