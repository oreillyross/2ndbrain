import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Link } from "wouter";

export function LinkedThoughts({ noteId }: { noteId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const utils = trpc.useUtils();

  const { data: links = [] } = trpc.links.getLinked.useQuery({ noteId });

  const linkedIds = new Set(links.map((l) => l.toNoteId));

  const { data: results = [] } = trpc.notes.search.useQuery(
    { query },
    { enabled: query.length > 0 },
  );

  const createLink = trpc.links.create.useMutation({
    onSuccess: () => {
      utils.links.getLinked.invalidate({ noteId });
      setQuery("");
      setOpen(false);
    },
  });

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2 items-center">
        {/* existing links */}
        {links.map((l) => (
          <Link to={`/note/${l.toNoteId}`}>
            <div
              key={l.id}
              className="px-3 py-1 bg-gray-200 rounded-full text-sm max-w-[120px] truncate"
            >
              {l.toTitle}
            </div>
          </Link>
        ))}

        {/* add button / input */}
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="px-3 py-1 border rounded-full text-sm"
          >
            +
          </button>
        )}

        {open && (
          <div className="relative">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="link thought..."
              className="px-3 py-1 border rounded-full text-sm"
            />

            {/* dropdown */}
            {results.length > 0 && (
              <div className="absolute top-10 left-0 bg-white border rounded shadow w-48 z-10">
                {results
                  .filter((r) => r.id !== noteId && !linkedIds.has(r.id))
                  .map((r) => (
                    <div
                      key={r.id}
                      onClick={() =>
                        createLink.mutate({
                          fromId: noteId,
                          toId: r.id,
                          toTitle: r.title,
                        })
                      }
                      className="p-2 hover:bg-gray-100 cursor-pointer text-sm truncate"
                    >
                      {r.title}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
