import { useState } from "react";
import type { Note } from "../../../shared";
import { trpc } from "../lib/trpc";
import { renderNoteContent } from "../lib/renderNoteContent";
import { useHandleLinkClick } from "../lib/useHandleLinkClick";

type Props = {
  note: Note;
  onView?: (note: Note) => void;
  onDelete?: (id: string) => void;
};

export default function NoteCard({ note, onView, onDelete }: Props) {
  const handleLinkClick = useHandleLinkClick();

  const { data: backlinks = [] } = trpc.notes.backlinks.useQuery({
    noteId: note.id,
  });

  const [hovered, setHovered] = useState(false);

  const MAX_LENGTH = 120;

  const isLong = note.content.length > MAX_LENGTH;
  const truncated = isLong
    ? note.content.slice(0, MAX_LENGTH) + "..."
    : note.content;

  return (
    <div
      className="border p-3 rounded cursor-pointer relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Main content */}
      <div className="text-sm whitespace-pre-wrap">
        {renderNoteContent(truncated, handleLinkClick)}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-2 text-xs">
        {onView && (
          <button onClick={() => onView(note)} className="text-blue-500">
            View
          </button>
        )}

        {onDelete && (
          <button onClick={() => onDelete(note.id)} className="text-red-500">
            Delete
          </button>
        )}
      </div>

      {/* Hover preview */}
      {hovered && isLong && (
        <div className="absolute z-10 top-full left-0 mt-1 w-full bg-white border p-3 shadow-lg text-sm whitespace-pre-wrap">
          {note.content}
        </div>
      )}
      {backlinks.length > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          Linked from:
          {backlinks.map((b) => (
            <div key={b.id}>• {b.toTitle}</div>
          ))}
        </div>
      )}
    </div>
  );
}
