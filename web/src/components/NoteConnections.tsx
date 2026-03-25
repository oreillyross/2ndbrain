import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { useLocation } from "wouter";
import { useKeyboardList } from "../lib/useKeyboardList";

export function NoteConnections({ noteId }: { noteId: string }) {
  const [, navigate] = useLocation();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const utils = trpc.useUtils();

  const { data: links = [] } = trpc.links.getLinked.useQuery({ noteId });
  const { data: backlinks = [] } = trpc.links.getBacklinks.useQuery({ noteId });
  console.log("links are:", links)
  const { data: results = [] } = trpc.notes.search.useQuery(
    { query },
    { enabled: query.length > 0 },
  );

  const exactMatch = results.find(
    (r) => r.title.toLowerCase() === query.toLowerCase(),
  );

  const shouldShowCreate = query.length > 0 && !exactMatch;



  const createLink = trpc.links.create.useMutation({
    onSuccess: () => {
      utils.links.getLinked.invalidate({ noteId });
      utils.links.getBacklinks.invalidate({ noteId });

      setQuery("");
      setActiveIndex(0);
    },
  });

  const deleteLink = trpc.links.delete.useMutation({
    onSuccess: () => {
      utils.links.getLinked.invalidate({ noteId });
      utils.links.getBacklinks.invalidate({ noteId });
    },
  });

  const linkedIds = new Set(links.map((l) => l.links.toNoteId));

  const filteredResults = results.filter(
    (r) => r.id !== noteId && !linkedIds.has(r.id),
  );

  const { activeIndex, setActiveIndex, onKeyDown } = useKeyboardList(filteredResults);
  
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const createNote = trpc.notes.create.useMutation();

  async function handleCreate() {
    // 1. create note
    const newNote = await createNote.mutateAsync({
      title: query,
    });

    // 2. link it
    await createLink.mutateAsync({
      fromId: noteId,
      toId: newNote.id,
      toTitle: query,
    });

    // 3. navigate
    navigate(`/note/${newNote.id}?edit=true`);

    // 4. reset UI
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="mt-6 space-y-4">
      {/* 🔙 Backlinks */}
      {backlinks.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-1">Linked from</div>
          <div className="flex flex-wrap gap-2">
            {backlinks.map((b) => (
              <div
                key={b.id}
                onClick={() => navigate(`/note/${b.fromNoteId}`)}
                className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm max-w-[120px] truncate cursor-pointer hover:scale-105 hover:shadow transition"
              >
                {b.fromTitle}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* divider */}
      <div className="border-t my-2" />

      {/* 🔗 Outgoing links */}
      <div>
        <div className="text-xs text-gray-500 mb-1">Links</div>

        <div className="flex flex-wrap gap-2 items-center">
          {links.map((l) => (
            <div
              key={l.links.id}
              onClick={() => navigate(`/note/${l.links.toNoteId}`)}
              className="group flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm max-w-[140px] cursor-pointer hover:scale-105 hover:shadow transition"
            >
              <span className="truncate flex-1">{l.links.toTitle}</span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteLink.mutate({ id: l.links.id });
                }}
                className="ml-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          ))}

          {/* add */}
          {!open && (
            <button
              onClick={() => setOpen(true)}
              className="px-3 py-1 border rounded-full text-sm hover:bg-gray-100"
            >
              +
            </button>
          )}

          {open && (
            <div className="relative">
              <input
                autoFocus
                value={query}
                onKeyDown={(e) => {
                  onKeyDown(e);

                  if (e.key === "Enter") {
                    e.preventDefault();

                    const selected = filteredResults[activeIndex];
                    if (selected) {
                      
                    createLink.mutate({
                      fromId: noteId,
                      toId: selected.id,
                      toTitle: selected.title,
                    }) 
                    } else if (shouldShowCreate) {
                      handleCreate()
                    } 

                  }

                  if (e.key === "Escape") {
                    setOpen(false);
                    setQuery("");
                  }
                }}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="link thought..."
                className="px-3 py-2 ml-2 border rounded  text-sm"
              />

              {(filteredResults.length > 0 || shouldShowCreate) && (
                <div className="absolute top-10 left-0 bg-white border rounded shadow w-48 z-10">
                  {filteredResults.map((r, i) => (
                    <div
                      key={r.id}
                      onClick={() =>
                        createLink.mutate({
                          fromId: noteId,
                          toId: r.id,
                          toTitle: r.title,
                        })
                      }
                      className={`p-2 cursor-pointer text-sm truncate ${
                        i === activeIndex ? "bg-blue-100" : "hover:bg-gray-100"
                      }`}
                    >
                      {r.title}
                    </div>
                  ))}
                  {shouldShowCreate && (
                    <div
                      className="px-3 py-2 text-sm text-blue-600 cursor-pointer hover:bg-gray-100"
                      onClick={handleCreate}
                    >
                      ➕ Create "{query}"
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
