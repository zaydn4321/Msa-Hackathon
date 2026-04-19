import React, { useState, useEffect } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { useAuth } from "@clerk/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Clock, CheckCircle2, Loader2, FileText } from "lucide-react";

export default function PatientPortal() {
  const { isSignedIn, isLoaded } = useAuth();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [, setLocation] = useLocation();

  if (!isLoaded || userLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (user && user.role !== "patient") return <Redirect to="/portal" />;

  const patientName = (user?.record as any)?.name ?? "there";

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b border-border/50 px-4 py-8 md:px-8">
        <div className="container max-w-screen-xl mx-auto">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Patient dashboard</p>
          <h1 className="font-serif text-4xl font-medium text-foreground">
            Welcome back{patientName !== "there" ? `, ${patientName.split(" ")[0]}` : ""}.
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Your intake history and session results are here.
          </p>
        </div>
      </div>

      <div className="flex-1 px-4 py-10 md:px-8">
        <div className="container max-w-screen-xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">

            {/* Left: Start intake CTA */}
            <div className="md:col-span-1">
              <div className="border border-border/60 rounded-xl p-6 flex flex-col gap-4 bg-card">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">New intake</p>
                <h2 className="font-serif text-2xl font-medium text-foreground leading-tight">
                  Ready to begin your intake?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A 20-minute video conversation with our AI intake specialist. No forms. At the end, you'll be matched to a provider.
                </p>
                <div className="flex flex-col gap-2 text-sm text-muted-foreground mt-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    <span>AI video conversation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    <span>Biometric monitoring</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    <span>SOAP brief generated automatically</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    <span>Provider matched at the end</span>
                  </div>
                </div>
                <Link href="/intake/new">
                  <Button className="rounded-md h-10 w-full text-sm font-medium mt-2">
                    Start intake <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>

              <div className="mt-5 border border-border/50 rounded-xl p-5">
                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Browse providers</p>
                <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                  View our full network of 50+ verified therapists and specialists.
                </p>
                <Link href="/therapists" className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline underline-offset-4">
                  View therapist roster <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Right: Session history */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-serif text-xl font-medium text-foreground">Your sessions</h2>
                <Link href="/sessions" className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                  View all →
                </Link>
              </div>
              <SessionsList />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionsList() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/patient/my-sessions", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setSessions(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading sessions…
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="border border-border/50 rounded-xl p-8 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No sessions yet. Start your first intake to see results here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sessions.slice(0, 6).map((session: any) => {
        const isComplete = !!session.endedAt;
        const date = new Date(session.startedAt).toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric",
        });
        return (
          <Card key={session.id} className="bg-card border-border/50 hover:border-primary/30 transition-colors">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${isComplete ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                {isComplete ? <CheckCircle2 className="h-4.5 w-4.5" /> : <Clock className="h-4.5 w-4.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {session.label ?? `Session #${session.id}`}
                </p>
                <p className="text-xs text-muted-foreground">{date} — {isComplete ? "Completed" : "In progress"}</p>
              </div>
              {isComplete && (
                <Link href={`/intake/${session.id}/brief`}>
                  <button className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    View brief <ArrowRight className="h-3 w-3" />
                  </button>
                </Link>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
