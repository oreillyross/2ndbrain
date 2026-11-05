import { trpc } from "../lib/trpc";

/** Cloudflare Access logout endpoint (same origin when the app sits behind Access). */
const LOGOUT_URL = "/cdn-cgi/access/logout";

export function AuthStatus() {
  const { data: user, isLoading } = trpc.auth.me.useQuery(undefined, {
    staleTime: Infinity,
  });

  if (isLoading || !user) return null;

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-700">{user.email}</span>
      <a href={LOGOUT_URL} className="text-red-500 hover:underline">
        Logout
      </a>
    </div>
  );
}
