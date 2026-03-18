import { Route, Switch, Link } from "wouter";
import CreateNote from "./pages/CreateNote";
import NotesList from "./pages/NotesList";
import SearchScreen from "./pages/SearchScreen";

export default function App() {
  return (
    <div>
      <nav className="p-4 flex gap-4">
        <Link href="/">Notes</Link>
        <Link href="/notes/create">New</Link>
      </nav>
      <SearchScreen/>
     

      <Switch>
        <Route path="/" component={NotesList} />
        <Route path="/notes/create" component={CreateNote} />
      </Switch>
    </div>
  );
}