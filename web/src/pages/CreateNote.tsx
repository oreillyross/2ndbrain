import { useState, useRef, useEffect } from "react";
import { trpc } from "../lib/trpc";
import type { Note } from "../../../shared";
import { useLocation } from "wouter";
import { useKeyboardList } from "../lib/useKeyboardList";

export default function CreateNote() {
  const [title, setTitle] = useState("");
  const [debouncedTitle, setDebouncedTitle] = useState("");

  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedTitle(title);
    }, 150); // fast, responsive

    return () => clearTimeout(t);
  }, [title]);

  // 🔍 search existing notes
  const { data: results = [] } = trpc.notes.search.useQuery(
    { query: debouncedTitle },
    { enabled: debouncedTitle.length > 1 },
  );
  const limitedResults = results.slice(0, 5);

  const { activeIndex, onKeyDown } = useKeyboardList(limitedResults);

  // 🧠 create note (same as before)
  const createNote = trpc.notes.create.useMutation({
    onMutate: async (newNote) => {
      await utils.notes.list.cancel();

      const prev = utils.notes.list.getData();

      const optimisticNote: Note = {
        id: "temp-" + Date.now().toString(),
        title: newNote.title,
        createdAt: new Date(),
        updatedAt: new Date(),
        content: "",
        searchVector: "",
      };

      utils.notes.list.setData(undefined, (old) => [
        optimisticNote,
        ...(old ?? []),
      ]);

      setTitle(""); // clear input

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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    onKeyDown(e);

    if (e.key === "Enter") {
      e.preventDefault();
      const selected =
        limitedResults.length > 0 ? limitedResults[activeIndex] : null;
      if (selected) {
        navigate(`/note/${selected.id}`);
        return;
      }
    }
    if (e.key === "Enter" && title.trim()) {
      e.preventDefault();
      createNote.mutate({ title });
    }
  }

  return (
    <div className="flex justify-center">
      <div className="relative w-full max-w-xl">
        {/* Input */}
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a thought..."
          className="w-full text-lg p-2 border-none outline-none"
        />

        {/* 🔥 Dropdown results */}
        {results.length > 0 && title.length > 1 && (
          <div className="absolute mt-2 w-full bg-white border rounded shadow text-sm z-10">
            {limitedResults.map((note, i) => (
              <div
                key={note.id}
                onClick={() => navigate(`/note/${note.id}`)}
                className={`p-2 hover:bg-gray-100 cursor-pointer ${
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
