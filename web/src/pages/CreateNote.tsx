import { useState, useRef, useEffect, useMemo } from "react";
import { trpc } from "../lib/trpc";

import { useLocation } from "wouter";
import { useKeyboardList } from "../lib/useKeyboardList";



export default function CreateNote() {
  const [title, setTitle] = useState("");
  const [debouncedTitle, setDebouncedTitle] = useState("");

  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  // debounce input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedTitle(title);
    }, 150);
    return () => clearTimeout(t);
  }, [title]);

  // 🔍 search existing notes
  const { data: results = [] } = trpc.notes.search.useQuery(
    { query: debouncedTitle },
    { enabled: debouncedTitle.length > 1 },
  );

  // ✅ FIX: stable reference
  const limitedResults = useMemo(() => results.slice(0, 5), [results]);

  const { activeIndex, onKeyDown } = useKeyboardList(limitedResults);
  const { data: user } = trpc.auth.me.useQuery();
  // 🧠 create note
  const createNote = trpc.notes.create.useMutation({
    onMutate: async (newNote) => {
      await utils.notes.list.cancel();

      const prev = utils.notes.list.getData();

      const optimisticNote: any = {
        id: "temp-" + Date.now().toString(),
        userId: user!.id,
        title: newNote.title,
        createdAt: new Date(),
        updatedAt: new Date(),
        content: "",
              };

      utils.notes.list.setData(undefined, (old) => [
        optimisticNote,
        ...(old ?? []),
      ]);

      setTitle("");

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

    onSuccess: (newNote) => {
      navigate(`/note/${newNote.id}`);
    },
  });

  // autofocus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ✅ FIXED keyboard logic
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      onKeyDown(e);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();

      const selected = limitedResults[activeIndex];

      // 👉 if result exists → open it
      if (selected) {
        navigate(`/note/${selected.id}`);
        return;
      }

      // 👉 otherwise create new
      if (title.trim()) {
        createNote.mutate({ title });
      }
    }
  }

  return (
    <div className="flex justify-center">
      <div className="relative w-full max-w-xl">
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a thought..."
          className="w-full text-lg p-2 border-none outline-none"
        />

        {limitedResults.length > 0 && title.length > 1 && (
          <div className="absolute mt-2 w-full bg-white border rounded shadow text-sm z-10">
            {limitedResults.map((note, i) => (
              <div
                key={note.id}
                onClick={() => navigate(`/note/${note.id}`)}
                className={`p-2 cursor-pointer ${
                  i === activeIndex ? "bg-blue-100" : "hover:bg-gray-100"
                }`}
              >
                {note.title}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
