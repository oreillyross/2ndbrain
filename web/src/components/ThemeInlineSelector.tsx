import { useState } from "react";
import { trpc } from "../lib/trpc";

export function ThemeInlineSelector({
  noteId,
  themeId,
}: {
  noteId: string;
  themeId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils()
  const { data: themes = [] } = trpc.themes.list.useQuery();

  const assignTheme = trpc.notes.assignTheme.useMutation({
    onSuccess: () => {
      utils.notes.getById.invalidate({ id: noteId }); // ✅ key fix
      utils.notes.list.invalidate(); // optional but good
      setOpen(false);
    },
  });

  const activeTheme = themes.find((t) => t.id === themeId);

  return (
    <div className="mt-2">
      {/* CLOSED STATE */}
      {!open && (
        <div
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-2 py-1 border rounded text-xs text-gray-600 hover:bg-gray-100 cursor-pointer"
        >
          <span>
            {activeTheme ? activeTheme.name : "No theme"}
          </span>

          <span className="text-gray-400">
            {activeTheme ? "↻" : "+"}
          </span>
        </div>
      )}

      {/* OPEN STATE */}
      {open && (
        <div className="flex gap-2 flex-wrap mt-2">
          <button
            onClick={() =>
              assignTheme.mutate({
                noteId,
                themeId: null,
              })
            }
            className={`px-2 py-1 text-xs rounded border ${
              !themeId ? "bg-black text-white" : ""
            }`}
          >
            No theme
          </button>

          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() =>
                assignTheme.mutate({
                  noteId,
                  themeId: t.id,
                })
              }
              className={`px-2 py-1 text-xs rounded border ${
                themeId === t.id ? "bg-black text-white" : ""
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}