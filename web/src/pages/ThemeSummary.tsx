import { trpc } from "../lib/trpc";

export function ThemeSummary({ themeId }: { themeId: string }) {
  const utils = trpc.useUtils();

  const summarise = trpc.themes.summarise.useMutation({
    onSuccess: () => {
      // 🔄 refresh theme data after summary is saved
      utils.themes.list.invalidate();
    },
  });

  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        onClick={() => summarise.mutate({ themeId })}
        disabled={summarise.isPending}
        className="px-3 py-1.5 text-sm rounded bg-black text-white hover:opacity-80 disabled:opacity-50"
      >
        {summarise.isPending ? "Thinking..." : "Summarise"}
      </button>

      {summarise.isError && (
        <span className="text-sm text-red-500">Failed to generate summary</span>
      )}

      {summarise.isSuccess && !summarise.isPending && (
        <span className="text-sm text-green-600">Summary updated</span>
      )}
    </div>
  );
}
