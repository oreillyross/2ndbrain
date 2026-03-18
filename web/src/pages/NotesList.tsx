import { trpc } from "../lib/trpc";

export default function NotesList() {
  const { data: notes = [] } = trpc.notes.list.useQuery();
  console.log(notes)
  return (
    <div className="p-6 max-w-xl mx-auto space-y-2">
      <h1 className="text-xl font-bold mb-4">Notes</h1>

      {notes.map((n: any) => (
        <div key={n.id} className="border p-2">
          {n.content}
        </div>
      ))}
    </div>
  );
}