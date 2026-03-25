import { Route, Switch, Link } from "wouter";
import { Brain } from "lucide-react";
import { trpc } from "./lib/trpc";

import Home from "./pages/Home";
import SingleNote from "./pages/SingleNote";
import Login from "./pages/Login";
import {AuthStatus} from "./components/AuthStatus"
import AuthCallback from "./auth/callback";
import { ThemeDetail } from "./pages/ThemeDetailPage";

export default function App() {
  const { data: user, isLoading } = trpc.auth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        <nav className="p-4 flex items-center">
          <Link href="/">
            <div className="pt-6 pl-6">
              <div className="flex items-center gap-2 text-xl font-semibold text-gray-800 hover:opacity-80 transition">
                <Brain className="w-5 h-5" />
                <span>2ndBrain</span>
              </div>
            </div>
          </Link>

          <div className="ml-auto">
            <AuthStatus />
          </div>
        </nav>

        <Switch>
          
          <Route path="/auth/callback" component={AuthCallback} />

          {/* ✅ auth-gated routes */}
          {!user && <Route path="/" component={Login} />}
          {user && (
            <>
              <Route path="/note/:id" component={SingleNote} />
              <Route path="/theme/:id" component={ThemeDetail}/>
              <Route path="/" component={Home} />
            </>
          )}
        </Switch>
      </div>

      <div className="text-center text-sm text-gray-400 py-6">
        notetaking at the speed of thought
      </div>
    </div>
  );
}