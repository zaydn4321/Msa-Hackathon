import { useState, useEffect } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { useAuth } from "@clerk/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, FileText, ArrowRight, Video, Clock } from "lucide-react";
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
        <Loader2 className="h-5 w-5 animate-spin text-[#9B7250]" />
      </div>
    );
  }

  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (user && user.role !== "patient") return <Redirect to="/portal" />;

  return (
    <div className="container max-w-4xl mx-auto py-12 px-4 md:px-8 space-y-8 bg-[#F8F9FA] min-h-[100dvh]">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-serif text-4xl font-medium tracking-tight text-[#2D2626]">Your Sessions</h1>
          <p className="text-lg text-[#5C544F]">A history of your intake and clinical briefs.</p>
        </div>
        <Button asChild className="rounded-xl bg-[#9B7250] hover:bg-[#8B6B5D] text-white">
          <Link href="/intake/new">Start new intake</Link>
        </Button>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 text-[#9B7250] animate-spin mb-4" />
          <p className="text-[#5C544F]">Loading your history...</p>
        </div>
      ) : sessions && sessions.length > 0 ? (
        <div className="space-y-4">
          {[...sessions].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).map(session => {
            const isCompleted = !!session.endedAt;
            return (
              <Card
                key={session.id}
                className={`bg-white border-[#E8E1D7] rounded-2xl shadow-sm transition-colors ${isCompleted ? "hover:border-[#9B7250]/30 cursor-pointer" : ""}`}
                onClick={() => isCompleted ? setLocation(`/intake/${session.id}/brief`) : setLocation(`/intake/${session.id}`)}
              >
                <CardContent className="p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between group">
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${isCompleted ? "bg-[#F5EFE6] text-[#9B7250]" : "bg-[#F8F9FA] border border-[#E8E1D7] text-[#5C544F]"}`}>
                      {isCompleted ? <FileText className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                    </div>
                    <div>
                      <h3 className="font-medium text-lg text-[#2D2626] group-hover:text-[#9B7250] transition-colors">
                        {session.label || `Intake Session #${session.id}`}
                      </h3>
                      <div className="flex items-center text-sm text-[#5C544F] mt-1">
                        <Calendar className="h-3.5 w-3.5 mr-1" />
                        {format(new Date(session.startedAt), "PPP 'at' p")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {isCompleted ? (
                      <span className="text-[11px] font-mono uppercase tracking-wider text-[#5C544F] bg-[#F8F9FA] border border-[#E8E1D7] px-2 py-1 rounded-md">
                        Completed
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded-md">
                        Active
                      </span>
                    )}

                    {isCompleted ? (
                      <Button variant="ghost" size="icon" className="hidden sm:flex text-[#5C544F] group-hover:text-[#9B7250] transition-colors ml-2 hover:bg-black/5">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="default" size="sm" className="ml-auto rounded-xl bg-[#2D2626] text-white hover:bg-black">
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
        <div className="py-24 text-center bg-white rounded-2xl border border-[#E8E1D7]">
          <FileText className="h-8 w-8 text-[#A09890] mx-auto mb-4" />
          <h3 className="font-serif text-xl font-medium text-[#2D2626] mb-2">No sessions yet</h3>
          <p className="text-[#5C544F] mb-6">Start your first intake to get matched with a provider.</p>
          <Button asChild className="rounded-xl bg-[#9B7250] hover:bg-[#8B6B5D] text-white" size="default">
            <Link href="/intake/new">Start intake</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
