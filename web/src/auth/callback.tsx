import { useSearch } from "wouter";
import { useEffect, useRef } from "react";
import { trpc } from "../lib/trpc";

export default function AuthCallback() {
  
  console.log("AUTH CALLBACK PAGE RENDERED");
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token");
  const hasRun = useRef(false)
  const verify = trpc.auth.verifyMagicLink.useMutation();

  useEffect(() => {
    if (!token || hasRun.current) return;
    hasRun.current = true;
    
    if (token) {
      verify.mutate(
        { token },
        {
          onSuccess: () => {
            window.location.href = "/";
          },
        }
      );
    }
  }, [token]);

  return <div>Signing you in...</div>;
}