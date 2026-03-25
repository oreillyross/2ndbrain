import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { trpc } from "../lib/trpc";
import { useParams, useLocation } from "wouter";
import { ThemeInlineSelector } from "../components/ThemeInlineSelector";
import { NoteConnections } from "../components/NoteConnections";

export default function SingleNote() {
  const initialEditingState = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("edit") === "true";
  };
  const hasHydrated = useRef(false);
  const lastSaved = useRef("");
  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  const { id: noteId } = useParams<{ id: string }>();

  const utils = trpc.useUtils();
  const { data: note, isLoading } = trpc.notes.getById.useQuery({ id: noteId });

  const [location] = useLocation();
  const formatDate = (d: Date | string) => new Date(d).toLocaleString();
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [debouncedContent, setDebouncedContent] = useState(content);
  const [isEditing, setIsEditing] = useState<boolean>(initialEditingState);

  const updateNote = trpc.notes.update.useMutation({
    onSuccess: (updatedNote) => {
      console.log("✅ MUTATION SUCCESS");
      utils.notes.getById.setData({ id: noteId }, updatedNote);
      utils.notes.list.invalidate();
       setShowSaved(true);
        const t = setTimeout(() => setShowSaved(false), 1500);
        return () => clearTimeout(t);
    },
  });

  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (note && !hasHydrated.current) {
      setContent(note.content ?? "");
      setTitle(note.title);
      hasHydrated.current = true;
    }
  }, [note]);

  // Debounce content changes to avoid firing updates on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedContent(content);
    }, 600);

    return () => clearTimeout(t);
  }, [content]);

  // Sync edit mode with URL query (?edit=true) when location changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("edit") === "true") {
      setIsEditing(true);
    }
  }, [location]);

  // Load note content into state when viewing (but don't overwrite while editing)
  useEffect(() => {
    if (note && !isEditing) {
      setContent(note.content ?? "");
      setTitle(note.title);
    }
  }, [note, isEditing]);

   useEffect(() => {
    if (!isEditing) return;
    if (!note) return;

    const currentContent = note.content ?? "";

    if (debouncedContent === currentContent && title === note.title) return;

    if (debouncedContent === lastSaved.current) return;
    lastSaved.current = debouncedContent;

    updateNote.mutate({
      id: noteId,
      title,
      content: debouncedContent,
      themeId: note.themeId ?? null,
    });
  }, [debouncedContent, note, title, isEditing]);
  
  useEffect(() => {
    if (note) {
      setContent(note.content ?? "");
      setTitle(note.title);
      // setForm({
      //   title: note.title,
      //   content: note.content ?? "",
      // });
    }
  }, [note]);

  useLayoutEffect(() => {
    if (isEditing && contentRef.current) {
      contentRef.current.focus();
      const el = contentRef.current;
      const l = el.value.length;
      el.setSelectionRange(l, l);
    }
  }, [isEditing, note]);

  if (isLoading) return <div>Loading...</div>;
  if (!note) return <div>Note not found</div>;

  // const [form, setForm] = useState({
  //   title: "",
  //   content: "",
  // });

  // const updateField = (field: keyof typeof form, value: string) => {
  //   setForm((prev) => ({ ...prev, [field]: value }));
  // };

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
        <ThemeInlineSelector noteId={note.id} themeId={note.themeId ?? null} />
        <div className="text-xs text-gray-500 mt-1 w-20 text-right">
          {updateNote.isPending
            ? "Saving..."
            : showSaved
            ? "✓ Saved"
            : ""}
        </div>
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
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
        <>
          <textarea
            ref={contentRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-40 border p-3 text-sm"
          />
        </>
      )}

      {/* SAVE / CANCEL */}
      {isEditing && (
        <div className="flex gap-2">
          <button
            onClick={() => {
              updateNote.mutate({
                id: note.id,
                title,
                content: content ?? "",
                themeId: note.themeId ?? null,
              });
              setIsEditing(false);
            }}
            className="text-green-600 text-sm"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
