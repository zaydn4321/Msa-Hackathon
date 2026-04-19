import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";

export type UserRole = "patient" | "therapist" | null;

export type CurrentUser = {
  role: UserRole;
  record: Record<string, unknown> | null;
};

export function useCurrentUser() {
  const { isSignedIn } = useAuth();

  return useQuery<CurrentUser>({
    queryKey: ["auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch user info");
      return res.json();
    },
    enabled: !!isSignedIn,
    staleTime: 1000 * 60 * 5,
  });
}
