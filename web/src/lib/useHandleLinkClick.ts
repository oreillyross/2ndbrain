import { trpc } from "./trpc";
import { useLocation } from "wouter";
import { handleLinkClickCore } from "./linkHandler";

export function useHandleLinkClick() {
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();

  return (title: string) =>
    handleLinkClickCore({
      title,
      trpcClient: utils,
      navigate,
    });
}