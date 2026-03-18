export async function handleLinkClickCore({
  title,
  trpcClient,
  navigate,
}: {
  title: string;
  trpcClient: any; // we’ll pass utils or client
  navigate: (path: string) => void;
}) {
  // 1. try find existing
  const existing = await trpcClient.notes.getByTitle.fetch({ title });

  if (existing) {
    navigate(`/note/${existing.id}`);
    return;
  }

  // 2. create if missing
  const newNote = await trpcClient.notes.create.mutate({
    content: title,
  });

  navigate(`/note/${newNote.id}`);
}