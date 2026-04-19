import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { useAuth, useUser } from "@clerk/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { LogOut, LayoutDashboard } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), retry: false, refetchInterval: 30000 } });
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const { data: currentUser } = useCurrentUser();

  const portalPath =
    currentUser?.role === "patient"
      ? "/patient-portal"
      : currentUser?.role === "therapist"
      ? "/therapist-portal"
      : "/portal";

  const isOnAuth = location.startsWith("/sign-in") || location.startsWith("/sign-up") || location === "/onboarding";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary-foreground font-sans">
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/95 backdrop-blur-sm">
        <div className="container flex h-14 max-w-screen-xl items-center px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2.5 mr-8 transition-opacity hover:opacity-70">
            <div className="h-5 w-5 rounded-sm bg-primary flex items-center justify-center">
              <div className="h-2 w-2 rounded-[1px] bg-primary-foreground opacity-80" />
            </div>
            <span className="font-serif text-lg font-medium tracking-tight text-foreground">Anamnesis</span>
          </Link>

          {!isOnAuth && (
            <nav className="flex flex-1 items-center gap-6 text-sm">
              <Link
                href="/"
                className={cn("transition-colors hover:text-foreground", location === "/" ? "text-foreground font-medium" : "text-muted-foreground")}
              >
                Home
              </Link>
              {isSignedIn && currentUser?.role && (
                <Link
                  href={portalPath}
                  className={cn("transition-colors hover:text-foreground", location === portalPath || location.startsWith("/patient-portal") || location.startsWith("/therapist-portal") ? "text-foreground font-medium" : "text-muted-foreground")}
                >
                  Dashboard
                </Link>
              )}
              {(!isSignedIn || currentUser?.role === "patient") && (
                <Link
                  href="/sessions"
                  className={cn("transition-colors hover:text-foreground", location.startsWith("/sessions") ? "text-foreground font-medium" : "text-muted-foreground")}
                >
                  Sessions
                </Link>
              )}
              <Link
                href="/therapists"
                className={cn("transition-colors hover:text-foreground", location.startsWith("/therapists") ? "text-foreground font-medium" : "text-muted-foreground")}
              >
                Therapists
              </Link>
              {(!isSignedIn || currentUser?.role !== "therapist") && (
                <Link
                  href="/sign-in"
                  className="transition-colors hover:text-foreground text-muted-foreground text-sm"
                >
                  For clinicians
                </Link>
              )}
            </nav>
          )}

          {isOnAuth && <div className="flex-1" />}

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1.5 mr-2 text-xs text-muted-foreground" title="API Status">
              <div className={cn("h-1.5 w-1.5 rounded-full", health?.status === "ok" ? "bg-emerald-500" : "bg-destructive animate-pulse")} />
              {health?.status === "ok" ? "Live" : "Connecting"}
            </div>

            {isSignedIn ? (
              <div className="flex items-center gap-3">
                {currentUser?.role === "patient" && (
                  <Link href="/intake/new" className="hidden sm:inline-flex h-8 items-center justify-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
                    New intake
                  </Link>
                )}
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center text-xs font-medium text-foreground">
                      {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <span>{user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress?.split("@")[0]}</span>
                  </div>
                  <button
                    onClick={() => signOut({ redirectUrl: "/" })}
                    className="h-7 w-7 rounded-md border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                    title="Sign out"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/sign-in"
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  Get started
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
