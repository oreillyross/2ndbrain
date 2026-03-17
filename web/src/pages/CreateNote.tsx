import { useState, useRef, useEffect } from "react";
import { trpc } from "../lib/trpc";
import type { Note } from "../../../shared";

export default function CreateNote() {
  const [content, setContent] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const createNote = trpc.notes.create.useMutation({
    // newNote has shape of input: { content: string }
    onMutate: async (newNote) => {
      await utils.notes.list.cancel();

      const prev = utils.notes.list.getData(); // Note[] | undefined

      const optimisticNote: Note = {
        id: "temp-" + Date.now().toString(),
        content: newNote.content,
        createdAt: new Date(), // Drizzle `timestamp` -> Date
      };

      utils.notes.list.setData(undefined, (old) => [
        optimisticNote,
        ...(old ?? []),
      ]);

      // Clear input immediately
      setContent("");

      return { prev };
    },

    onError: (_err, _newNote, ctx) => {
      if (ctx?.prev) {
        utils.notes.list.setData(undefined, ctx.prev);
      }
    },

    onSettled: () => {
      utils.notes.list.invalidate();
    },
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && content.trim()) {
      e.preventDefault();
      createNote.mutate({ content });
    }
  }

  return (
    <div className="h-screen flex items-center justify-center">
      <input
        ref={inputRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a thought..."
        className="w-full max-w-xl text-xl p-4 border-none outline-none"
      />
    </div>
  );
}
