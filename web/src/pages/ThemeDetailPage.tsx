import { useParams } from "wouter";
import { trpc } from "../lib/trpc";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";

export function ThemeDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data: theme, isLoading } = trpc.themes.getById.useQuery({ id });
  const { data: notes = [] } = trpc.notes.byTheme.useQuery({ themeId: id });

  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!notes.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, notes.length - 1));
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }

      if (e.key === "Enter") {
        const note = notes[selectedIndex];
        if (!note) return;

        setActiveNoteId((prev) =>
          prev === note.id ? null : note.id
        );
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [notes, selectedIndex]);

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (!theme) return <div className="p-6">Theme not found</div>;

  return (
    <div className="max-w-2xl mx-auto mt-10 px-6">
      {/* HEADER */}
      <div className="ml-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {theme.name}
        </h1>

        {theme.description && (
          <p className="text-gray-600 mt-2">
            {theme.description}
          </p>
        )}

        <div className="text-xs text-gray-400 mt-1">
          {notes.length} notes
        </div>
      </div>

      {/* SYNOPSIS */}
      {theme.synopsis && (
        <div className="mt-6 p-4 bg-gray-100 rounded-lg">
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
            AI Summary
          </div>
          <div className="text-sm leading-relaxed">
            {theme.synopsis}
          </div>
        </div>
      )}

      {/* NOTES */}
      <div className="mt-8">
        <div className="text-xs text-gray-500 mb-3 uppercase tracking-wide ml-2">
          Notes
        </div>

        <div className="divide-y">
          {notes.map((note, i) => {
            const isActive = activeNoteId === note.id;
            const isSelected = selectedIndex === i;

            return (
              <div
                key={note.id}
                className={`px-2 py-4 transition ${
                  isSelected ? "bg-gray-50" : ""
                }`}
              >
                <button
                  onClick={() =>
                    setActiveNoteId((prev) =>
                      prev === note.id ? null : note.id
                    )
                  }
                  className="w-full text-left"
                >
                  <div className="font-medium">
                    {note.title || "Untitled"}
                  </div>

                  {!isActive && note.content && (
                    <div className="text-sm text-gray-500 mt-1 line-clamp-1">
                      {note.content}
                    </div>
                  )}
                </button>

                {/* EXPANDED VIEW */}
                {isActive && (
                  <div className="mt-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {note.content}

                    <div className="mt-3">
                      <button
                        onClick={() => navigate(`/note/${note.id}`)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Open full →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {notes.length === 0 && (
            <div className="text-sm text-gray-400 py-4 ml-2">
              No notes yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}