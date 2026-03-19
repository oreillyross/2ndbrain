import { Route, Switch, Link } from "wouter";

import Home from "./pages/Home";
import SearchScreen from "./pages/SearchScreen";
import SingleNote from "./pages/SingleNote";

export default function App() {
  return (
    <div>
      <nav className="p-4 flex gap-4">
        <Link href="/">Notes</Link>
       
      </nav>
    
     

      <Switch>
        <Route path="/" component={Home} />
        
        <Route path="/note/:id" component={SingleNote} />
        
      </Switch>
    </div>
  );
}