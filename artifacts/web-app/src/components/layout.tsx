import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { useAuth, useUser } from "@clerk/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Home as HomeIcon, LayoutDashboard, Users, Calendar, LogOut } from "lucide-react";
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
            </nav>
          </div>

          <div className="flex items-center gap-5">
            <Link href="/sign-in" className="text-[15px] font-medium text-foreground hover:opacity-80 transition-opacity hidden sm:block">
              Sign In
            </Link>
            <Link href={isSignedIn ? portalPath : "/sign-up"} className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-6 text-[15px] font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
              Get Started
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useAuth();
  const { user } = useUser();
  const { data: currentUser } = useCurrentUser();

  const isPatient = currentUser?.role === "patient";
  const isTherapist = currentUser?.role === "therapist";

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

        <div className="p-4 mt-auto border-t border-sidebar-border space-y-3">
          <div className="flex items-center gap-3 px-2">
            <Avatar className="h-9 w-9 bg-muted border border-border">
              <AvatarImage src={user?.imageUrl} />
              <AvatarFallback className="bg-primary/10 text-primary font-serif text-sm">{initials}</AvatarFallback>
            </Avatar>
            <p className="text-[14px] font-medium text-foreground truncate flex-1 min-w-0">{name}</p>
          </div>
          <button
            onClick={() => signOut({ redirectUrl: "/" })}
            className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-primary-foreground text-[14px] font-semibold shadow-sm hover:bg-primary/90 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
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
