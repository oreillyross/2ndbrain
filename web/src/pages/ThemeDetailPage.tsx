import {trpc} from "../lib/trpc"
import { useLocation } from "wouter";
import {ThemeSummary} from "./ThemeSummary"
// /themes/:id
export function ThemeDetail(themeId: string) {
  
const [, navigate] = useLocation()
const { data: notes = [] } = trpc.themes.getNotes.useQuery({ themeId });
  const { data: themes = [] } = trpc.themes.list.useQuery();

  const theme = themes.find(t => t.id === themeId);

  if (!theme) return null;
  
return (
  <div>
    {notes.map(n => (
      <div key={n.id} onClick={() => navigate(`/note/${n.id}`)}>
        {n.title}
      </div>
    ))}
    <div>
      <h1>{theme.name}</h1>

      {/* ✅ ACTION */}
      <ThemeSummary themeId={themeId} />

      {/* ✅ DISPLAY (goes here) */}
      {theme.synopsis ? (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <div className="text-sm text-gray-500 mb-2 flex justify-between">
            <span>AI Summary</span>

            {theme.synopsisUpdatedAt && (
              <span className="text-xs text-gray-400">
                {new Date(theme.synopsisUpdatedAt).toLocaleString()}
              </span>
            )}
          </div>

          <div className="whitespace-pre-wrap text-sm text-gray-800">
            {theme.synopsis}
          </div>
        </div>
      ) : (
        <div className="mt-4 p-4 border border-dashed rounded text-sm text-gray-400">
          No summary yet. Click <b>Summarise</b>.
        </div>
      )}
    </div>

  </div>
);

}