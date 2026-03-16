import { useState } from "react";
import { trpc } from "../lib/trpc";

export default function Notes() {

  const utils = trpc.useUtils();

  const notesQuery = trpc.notes.list.useQuery();

  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => utils.notes.list.invalidate(),
  });

  const [text, setText] = useState("");

  const handleAdd = () => {
    createNote.mutate({ content: text });
    setText("");
  };

  return (
    <div style={{ padding: 40 }}>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        cols={60}
      />

      <br />

      <button onClick={handleAdd}>
        Add note
      </button>

      <hr />

      {notesQuery.data?.map((note) => (
        <pre key={note.id}>{note.content}</pre>
      ))}

    </div>
  );
}