import { useState } from "react";
import type { Note } from "../../../shared";

type Props = {
  note: Note;
  onEdit?: (note: Note) => void;
  onDelete?: (id: string) => void;
};

export default function NoteCard({ note, onEdit, onDelete }: Props) {
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
        {truncated}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-2 text-xs">
        {onEdit && (
          <button
            onClick={() => onEdit(note)}
            className="text-blue-500"
          >
            Edit
          </button>
        )}

        {onDelete && (
          <button
            onClick={() => onDelete(note.id)}
            className="text-red-500"
          >
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
    </div>
  );
}