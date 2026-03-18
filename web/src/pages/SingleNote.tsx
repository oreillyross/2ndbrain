import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { useParams } from "wouter";
import { renderNoteContent } from "../lib/renderNoteContent";
import { useHandleLinkClick } from "../lib/useHandleLinkClick";

export default function SingleNote() {
const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState("");

  const { id: noteId } = useParams<{ id: string }>();

  const utils = trpc.useUtils();
  const handleLinkClick = useHandleLinkClick();
  const { data: note, isLoading } = trpc.notes.getById.useQuery({ id: noteId });

  const updateNote = trpc.notes.update.useMutation({
    onSuccess: () => {
      utils.notes.getById.invalidate({ id: noteId });
      utils.notes.list.invalidate();
    },
  });

  // sync when note loads
  useEffect(() => {
    if (note) setContent(note.content);
  }, [note]);

  if (isLoading) return <div>Loading...</div>;
  if (!note) return <div>Note not found</div>;

  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex justify-between">
        <button
          onClick={() => window.history.back()}
          className="text-sm text-gray-500"
        >
          ← Back
        </button>

        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-blue-500"
          >
            Edit
          </button>
        )}
      </div>

      {/* VIEW MODE */}
      {!isEditing && (
        <div className="whitespace-pre-wrap text-sm">
          {renderNoteContent(note.content, handleLinkClick)}
        </div>
      )}

      {/* EDIT MODE */}
      {isEditing && (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-64 border p-3 text-sm"
          autoFocus
        />
      )}

      {/* SAVE / CANCEL */}
      {isEditing && (
        <div className="flex gap-2">
          <button
            onClick={() => {
              updateNote.mutate({
                id: note.id,
                content,
              });
              setIsEditing(false);
            }}
            className="text-green-600 text-sm"
          >
            Save
          </button>

          <button
            onClick={() => {
              setContent(note.content);
              setIsEditing(false);
            }}
            className="text-gray-500 text-sm"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
