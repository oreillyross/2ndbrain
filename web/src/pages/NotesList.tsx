import { trpc } from "../lib/trpc";
import NoteCard from "../components/NoteCard"
import CreateNote from "./CreateNote"

export default function NotesList() {
  const { data: notes = [] } = trpc.notes.list.useQuery();
  const utils = trpc.useUtils()
  
  const deleteNote = trpc.notes.delete.useMutation({
    onSuccess: () => {
      utils.notes.list.invalidate()
    }
  })
 
return (
    <div className="p-6 max-w-xl mx-auto space-y-2">
     <CreateNote/>
      <h1 className="text-xl font-bold mb-4">All Notes</h1>

      {notes.map((n: any) => (
        <div key={n.id} className="border p-2">
          <NoteCard note={n} onDelete={(id) => deleteNote.mutate({id})} onView={() => console.log("edit note")}/>
        </div>
      ))}
    </div>
  );
}