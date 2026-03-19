import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { useParams } from "wouter";

import {NoteConnections} from "../components/NoteConnections"

export default function SingleNote() {
  const [isEditing, setIsEditing] = useState(false);

  const { id: noteId } = useParams<{ id: string }>();

  const utils = trpc.useUtils();
  const { data: note, isLoading } = trpc.notes.getById.useQuery({ id: noteId });

  const updateNote = trpc.notes.update.useMutation({
    onSuccess: () => {
      utils.notes.getById.invalidate({ id: noteId });
      utils.notes.list.invalidate();
    },
  });

  // 🔥 unified form state
  const [form, setForm] = useState({
    title: "",
    content: "",
  });

  // 🔥 atomic update helper
  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // sync when note loads
  useEffect(() => {
    if (note) {
      setForm({
        title: note.title,
        content: note.content ?? "",
      });
    }
  }, [note]);

  if (isLoading) return <div>Loading...</div>;
  if (!note) return <div>Note not found</div>;

  const formatDate = (d: Date | string) => new Date(d).toLocaleString();

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

      {/* Title */}
      {!isEditing ? (
        <>
          <div className="text-lg font-semibold">{note.title}</div>
          <div className="whitespace-pre-wrap text-sm text-gray-800">
            {note.content || (
              <span className="text-gray-400 italic">No content yet...</span>
            )}
            <NoteConnections noteId={noteId} />
          </div>
        </>
      ) : (
        <>
          <input
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
            className="w-full text-lg font-semibold border-b outline-none"
            autoFocus
          />
        </>
      )}

      {/* Dates */}
      <div className="text-xs text-gray-400 space-x-4">
        <span>Created: {formatDate(note.createdAt)}</span>
        <span>Updated: {formatDate(note.updatedAt)}</span>
      </div>

      {/* Content */}
      {isEditing && (
        <textarea
          value={form.content}
          onChange={(e) => updateField("content", e.target.value)}
          className="w-full h-40 border p-3 text-sm"
        />
      )}

      {/* SAVE / CANCEL */}
      {isEditing && (
        <div className="flex gap-2">
          <button
            onClick={() => {
              updateNote.mutate({
                id: note.id,
                title: form.title,
                content: form.content,
              });
              setIsEditing(false);
            }}
            className="text-green-600 text-sm"
          >
            Save
          </button>

          <button
            onClick={() => {
              // 🔥 reset form correctly
              setForm({
                title: note.title,
                content: note.content ?? "",
              });
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
