import { useListSessions, getListSessionsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Clock, ChevronRight, LayoutDashboard, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: sessions, isLoading, error } = useListSessions();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="border-b bg-card/50 backdrop-blur-md sticky top-0 z-20">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <h1 className="font-semibold tracking-wide text-lg" data-testid="text-dashboard-title">Provider Dashboard</h1>
          </div>
          <nav>
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Exit
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Session History</h2>
            <p className="text-muted-foreground mt-1">Review recent patient intake sessions and clinical briefs.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-24 bg-muted/20" />
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center border rounded-lg bg-destructive/5 border-destructive/20 text-destructive">
            <p>Failed to load sessions. Please try again.</p>
          </div>
        ) : sessions?.length === 0 ? (
          <div className="text-center py-24 border rounded-xl bg-card border-dashed">
            <LayoutDashboard className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground">No sessions found</h3>
            <p className="text-muted-foreground mt-2">Patient intake sessions will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessions?.map((session) => {
              const isActive = !session.endedAt;
              const startedDate = new Date(session.startedAt);
              
              let durationLabel = "Active";
              if (session.endedAt) {
                const diffMs = new Date(session.endedAt).getTime() - startedDate.getTime();
                const diffMins = Math.round(diffMs / 60000);
                durationLabel = `${diffMins} min`;
              }

              return (
                <Card key={session.id} className="group hover:border-primary/50 transition-colors" data-testid={`card-session-${session.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base font-medium flex items-center space-x-2">
                          <span className="font-mono text-muted-foreground text-sm">#{session.id.toString().padStart(4, "0")}</span>
                          <span>{session.label || "Intake Session"}</span>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {format(startedDate, "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                      <Badge variant={isActive ? "default" : "secondary"} className={isActive ? "bg-primary/20 text-primary hover:bg-primary/30 border-none" : ""}>
                        {isActive ? "Active" : "Completed"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                      <div className="flex items-center text-sm text-muted-foreground font-medium">
                        <Clock className="w-4 h-4 mr-1.5 opacity-70" />
                        {durationLabel}
                      </div>
                      <Link 
                        href={`/dashboard/${session.id}`}
                        className="inline-flex items-center justify-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                        data-testid={`link-view-brief-${session.id}`}
                      >
                        View Brief
                        <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
