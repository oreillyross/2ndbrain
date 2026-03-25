import { useState } from "react";
import { trpc } from "../lib/trpc";

export function CreateThemeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");

  const utils = trpc.useUtils();

  const createTheme = trpc.themes.create.useMutation({
    onSuccess: () => {
      utils.themes.list.invalidate();
      setName("");
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center">
      <div className="bg-white rounded-xl p-4 w-80 shadow-lg">
        <div className="text-sm mb-2 text-gray-500">New Theme</div>

        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Theme name..."
          className="w-full border rounded px-2 py-1 text-sm mb-3"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm px-2 py-1 text-gray-500"
          >
            Cancel
          </button>

          <button
            onClick={() => createTheme.mutate({ name })}
            disabled={!name || createTheme.isPending}
            className="text-sm px-3 py-1 bg-black text-white rounded disabled:opacity-50"
          >
            {createTheme.isPending ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}