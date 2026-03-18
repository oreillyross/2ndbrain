import {useState} from "react"
import {trpc} from "../lib/trpc"

export default function SearchScreen() {
  const [query, setQuery] = useState("");

  const { data: results = [], isLoading } =
    trpc.notes.search.useQuery(
      { query },
      { enabled: query.length > 0 }
    );

  console.log(results)
  return (
    <div className="p-4 max-w-xl mx-auto">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search notes..."
        className="border p-2 w-full"
      />

      <div className="mt-4 space-y-2">
        {isLoading && <div>Searching...</div>}
        {results.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="px-8 text-xl font-bold mb-4">
              Filtered Notes
            </div>

            {results.map((note) => (
              <div key={note.id} className="border p-2">
                {note.content}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}