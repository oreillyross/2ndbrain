import { trpc } from "../lib/trpc";

export function AuthStatus() {
  const { data: user, isLoading } = trpc.auth.me.useQuery(undefined, {
    staleTime: Infinity,
  });
  const utils = trpc.useUtils();

  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();

      window.location.href = "/";
    },
  });

  if (isLoading) return null;

  if (!user) {
    return <div className="text-sm text-gray-500">Not logged in</div>;
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-700">{user.email}</span>

      <button
        onClick={() => logout.mutate()}
        className="text-red-500 hover:underline"
      >
        Logout
      </button>
    </div>
  );
}
