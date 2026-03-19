import CreateNote from "./CreateNote";

export default function Home() {
  return (
    <div className="p-6 max-w-xl mx-auto space-y-2">
      <div className="
        text-5xl font-black text-gray-800 tracking-tight">Knowledge mate</div>
      <CreateNote />
    </div>
  );
}
