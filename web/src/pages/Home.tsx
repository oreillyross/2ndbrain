import CreateNote from "./CreateNote";
import {ThemePills} from "../components/ThemePills"

export default function Home() {
  return (
    <div className="p-6 max-w-xl mx-auto space-y-2">
    
      <CreateNote />
      <div>
        <div className="mt-24">
      Themes
          <ThemePills />
        </div>
      </div>
    </div>
  );
}
