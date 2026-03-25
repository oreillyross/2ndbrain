import { trpc } from "../lib/trpc";
import { useLocation } from "wouter";

export function ThemeListPage() {
  const { data: themes = [] } = trpc.themes.list.useQuery();
  const [, navigate] = useLocation();

  return (
    <div>
      {themes.map((t) => (
        <div key={t.id} onClick={() => navigate(`/themes/${t.id}`)}>
          <div>{t.name}</div>
          <div>{t.noteCount} notes</div>
        </div>
      ))}
    </div>
  );
}
