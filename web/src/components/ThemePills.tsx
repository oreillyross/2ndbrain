import { trpc } from "../lib/trpc";
import  { useState } from "react";
import { useLocation } from "wouter";
import {CreateThemeModal} from "../modals/CreateThemeModal"



export function ThemePills() {
  const { data: themes = [] } = trpc.themes.list.useQuery();
  const [, navigate] = useLocation();

  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <div className="flex items-center gap-2 flex-wrap mt-6">

      {/* existing themes */}
      {themes.map((t) => (
        <button
          key={t.id}
          onClick={() => navigate(`/themes/${t.id}`)}
          className="px-3 py-1 text-sm rounded-full border hover:bg-gray-100 transition"
        >
          {t.name}
        </button>
      ))}

      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-1 text-sm rounded-full border border-dashed text-gray-500 hover:bg-gray-100"
      >
        +
      </button>
      <CreateThemeModal open={isOpen} onClose={() => setIsOpen(false)} />

    </div>
  );
}