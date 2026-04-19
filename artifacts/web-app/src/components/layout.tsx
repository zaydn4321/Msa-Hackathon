import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { useAuth, useUser } from "@clerk/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Home as HomeIcon, LayoutDashboard, Users, Calendar, UserCog, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), retry: false, refetchInterval: 30000 } });
  const { isSignedIn } = useAuth();
  const { data: currentUser } = useCurrentUser();

  const portalPath =
    currentUser?.role === "patient"
      ? "/patient-portal"
      : currentUser?.role === "therapist"
      ? "/therapist-portal"
      : "/portal";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground font-sans">
      <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md border-b border-border/60 supports-[backdrop-filter]:bg-background/70">
        <div className="container flex h-[72px] max-w-screen-xl items-center justify-between px-6 md:px-8 mx-auto">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-70">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
                <span className="font-serif italic text-lg text-primary-foreground leading-none -mt-0.5">A</span>
              </div>
              <span className="font-serif text-2xl font-medium tracking-tight text-foreground">Anamnesis</span>
            </Link>

            <nav className="hidden md:flex items-center gap-7 text-[15px]">
              <Link href="/" className={cn("transition-colors hover:text-foreground", location === "/" ? "text-foreground font-medium" : "text-muted-foreground")}>Home</Link>
              <Link href="#" className="text-muted-foreground transition-colors hover:text-foreground">Product</Link>
              <Link href="#" className="text-muted-foreground transition-colors hover:text-foreground">For Patients</Link>
              <Link href="#" className="text-muted-foreground transition-colors hover:text-foreground">For Therapists</Link>
              <Link href="/therapists" className={cn("transition-colors hover:text-foreground", location.startsWith("/therapists") ? "text-foreground font-medium" : "text-muted-foreground")}>Directory</Link>
              <Link href="/demo" className={cn("transition-colors hover:text-foreground", location === "/demo" ? "text-foreground font-medium" : "text-muted-foreground")}>Demo</Link>
            </nav>
          </div>

          <div className="flex items-center gap-5">
            {isSignedIn ? (
              <Link href={portalPath} className="text-[15px] font-medium text-foreground hover:opacity-80 transition-opacity">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/sign-in" className="text-[15px] font-medium text-foreground hover:opacity-80 transition-opacity hidden sm:block">
                  Sign In
                </Link>
                <Link href="/sign-up" className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-6 text-[15px] font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}

const PRIOR_PATIENT_KEY = "anamnesis.dev.priorPatientId";

function useDevRoleSwitch(currentRole: "patient" | "therapist" | null | undefined) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/dev/role-switch/enabled", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setEnabled(!!d.enabled))
      .catch(() => setEnabled(false));
  }, []);

  const switchTo = async (target: "patient" | "therapist") => {
    if (busy) return;
    setBusy(true);
    try {
      const priorPatientId =
        target === "patient"
          ? Number(localStorage.getItem(PRIOR_PATIENT_KEY)) || undefined
          : undefined;
      const res = await fetch("/api/dev/role-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: target, priorPatientId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (target === "therapist" && data.priorPatientId) {
        localStorage.setItem(PRIOR_PATIENT_KEY, String(data.priorPatientId));
      }
      if (target === "patient") {
        localStorage.removeItem(PRIOR_PATIENT_KEY);
      }
      await queryClient.invalidateQueries({ queryKey: ["auth/me"] });
      setLocation(target === "therapist" ? "/therapist-portal" : "/patient-portal");
    } catch (err) {
      console.error("[dev role switch]", err);
      alert("Role switch failed — check console.");
    } finally {
      setBusy(false);
    }
  };

  return {
    enabled,
    busy,
    switchTo,
    canViewAsTherapist: enabled && currentRole === "patient",
    canViewAsPatient: enabled && currentRole === "therapist",
  };
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { signOut } = useAuth();
  const { user } = useUser();
  const { data: currentUser } = useCurrentUser();

  const isPatient = currentUser?.role === "patient";
  const isTherapist = currentUser?.role === "therapist";
  const devSwitch = useDevRoleSwitch(currentUser?.role);

  const initials = user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? "?";
  const name = user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ?? "User";

  const navItems = [
    { label: "Home", href: "/", icon: HomeIcon },
    ...(isPatient ? [{ label: "Patient Portal", href: "/patient-portal", icon: LayoutDashboard }] : []),
    ...(isTherapist ? [{ label: "Therapist Portal", href: "/therapist-portal", icon: LayoutDashboard }] : []),
    { label: "Directory", href: "/therapists", icon: Users },
  ];

  return (
    <div className="min-h-[100dvh] flex bg-background text-foreground font-sans">
      {/* Left Sidebar */}
      <aside className="w-[260px] bg-sidebar border-r border-sidebar-border flex flex-col hidden md:flex sticky top-0 h-[100dvh]">
        <div className="p-6">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-70">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
              <span className="font-serif italic text-lg text-primary-foreground leading-none -mt-0.5">A</span>
            </div>
            <span className="font-serif text-2xl font-medium tracking-tight text-foreground">Anamnesis</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.label} href={item.href} className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}>
                <item.icon className={cn("h-5 w-5 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                {item.label}
                {isActive && (
                  <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-sidebar-border space-y-2">
          {devSwitch.enabled && (devSwitch.canViewAsTherapist || devSwitch.canViewAsPatient) && (
            <button
              onClick={() =>
                devSwitch.switchTo(devSwitch.canViewAsTherapist ? "therapist" : "patient")
              }
              disabled={devSwitch.busy}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium text-primary bg-primary/10 hover:bg-primary/15 border border-primary/15 transition-colors disabled:opacity-60"
              title="Dev only — toggles between patient and therapist views"
            >
              {devSwitch.busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserCog className="h-4 w-4" />
              )}
              {devSwitch.canViewAsTherapist ? "View as therapist" : "View as patient"}
            </button>
          )}
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent/50 transition-colors">
            <Avatar className="h-9 w-9 bg-muted border border-border">
              <AvatarImage src={user?.imageUrl} />
              <AvatarFallback className="bg-primary/10 text-primary font-serif text-sm">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium text-foreground truncate">{name}</p>
              <button onClick={() => signOut({ redirectUrl: "/" })} className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-[72px] bg-sidebar/80 backdrop-blur-md border-b border-border/60 flex items-center justify-end px-8 sticky top-0 z-30">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2 text-[14px] font-medium text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-background p-6 md:p-8 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
