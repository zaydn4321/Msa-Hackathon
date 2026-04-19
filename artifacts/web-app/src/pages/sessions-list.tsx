import { useState, useEffect } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { useAuth } from "@clerk/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, FileText, ArrowRight, Video } from "lucide-react";
import { format } from "date-fns";

type Session = {
  id: number;
  label: string | null;
  startedAt: string;
  endedAt: string | null;
};

export default function SessionsList() {
  const { isSignedIn, isLoaded } = useAuth();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/patient/my-sessions", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setSessions(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isSignedIn]);

  if (!isLoaded || userLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (user && user.role !== "patient") return <Redirect to="/portal" />;

  return (
    <div className="container max-w-4xl mx-auto py-12 px-4 md:px-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-serif text-4xl font-medium tracking-tight text-foreground">Your Sessions</h1>
          <p className="text-lg text-muted-foreground">A history of your intake and clinical briefs.</p>
        </div>
        <Button asChild className="rounded-md">
          <Link href="/intake/new">Start new intake</Link>
        </Button>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground">Loading your history...</p>
        </div>
      ) : sessions && sessions.length > 0 ? (
        <div className="space-y-4">
          {[...sessions].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).map(session => {
            const isCompleted = !!session.endedAt;
            return (
              <Card
                key={session.id}
                className={`bg-card border-border/50 transition-colors ${isCompleted ? "hover:border-primary/30 cursor-pointer" : ""}`}
                onClick={() => isCompleted ? setLocation(`/intake/${session.id}/brief`) : setLocation(`/intake/${session.id}`)}
              >
                <CardContent className="p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between group">
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${isCompleted ? "bg-secondary text-secondary-foreground" : "bg-primary/10 text-primary"}`}>
                      {isCompleted ? <FileText className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                    </div>
                    <div>
                      <h3 className="font-medium text-lg text-foreground group-hover:text-primary transition-colors">
                        {session.label || `Intake Session #${session.id}`}
                      </h3>
                      <div className="flex items-center text-sm text-muted-foreground mt-1">
                        <Calendar className="h-3.5 w-3.5 mr-1" />
                        {format(new Date(session.startedAt), "PPP 'at' p")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {isCompleted ? (
                      <Badge variant="outline" className="bg-background border-border font-normal text-muted-foreground">
                        Completed
                      </Badge>
                    ) : (
                      <Badge variant="default" className="bg-primary/10 text-primary hover:bg-primary/20 font-normal border-none">
                        Active
                      </Badge>
                    )}

                    {isCompleted ? (
                      <Button variant="ghost" size="icon" className="hidden sm:flex text-muted-foreground group-hover:text-primary transition-colors ml-2">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="default" size="sm" className="ml-auto rounded-md">
                        Resume
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="py-24 text-center bg-card rounded-lg border border-border/50">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-medium text-foreground mb-2">No sessions yet</h3>
          <p className="text-muted-foreground mb-6">Start your first intake to get matched with a provider.</p>
          <Button asChild className="rounded-md" size="default">
            <Link href="/intake/new">Start intake</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
