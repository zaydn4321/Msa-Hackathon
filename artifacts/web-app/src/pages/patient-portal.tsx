import React, { useState, useEffect, useMemo } from "react";
import { Link, Redirect } from "wouter";
import { useAuth } from "@clerk/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useListTherapists } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Clock,
  Loader2,
  FileText,
  Users,
  CheckCircle2,
  PlayCircle,
  ClipboardList,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Session = {
  id: number;
  label: string | null;
  startedAt: string;
  endedAt: string | null;
};

type Match = {
  id: number;
  patientId: number;
  therapistId: number;
  sessionId: number;
  status: string;
  message: string | null;
  createdAt: string;
};

function useMySessions() {
  const [data, setData] = useState<Session[] | null>(null);
  useEffect(() => {
    fetch("/api/patient/my-sessions", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setData(Array.isArray(d) ? d : []))
      .catch(() => setData([]));
  }, []);
  return data;
}

function useMyMatches() {
  const [data, setData] = useState<Match[] | null>(null);
  useEffect(() => {
    fetch("/api/patient/my-matches", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setData(Array.isArray(d?.matches) ? d.matches : []))
      .catch(() => setData([]));
  }, []);
  return data;
}

type ScreenerRequest = {
  id: number;
  instrument: string;
  label: string;
  status: string;
  note: string | null;
  magicToken: string;
  expiresAt: string;
  therapistName: string;
};

function useMyScreenerRequests() {
  const [data, setData] = useState<ScreenerRequest[] | null>(null);
  useEffect(() => {
    const load = () =>
      fetch("/api/patient/screener-requests", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : { requests: [] }))
        .then((d) => setData(d.requests ?? []))
        .catch(() => setData([]));
    load();
    const i = setInterval(load, 8000);
    return () => clearInterval(i);
  }, []);
  return data;
}

function ScreenerRequestBanner({ requests }: { requests: ScreenerRequest[] }) {
  if (!requests || requests.length === 0) return null;
  return (
    <div className="bg-[#F5EFE6] border border-[#E8E1D7] rounded-2xl p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-white border border-[#E8E1D7] flex items-center justify-center">
          <ClipboardList className="h-4 w-4 text-[#9B7250]" />
        </div>
        <p className="font-medium text-[#2D2626] text-[15px]">
          {requests.length === 1
            ? `${requests[0].therapistName} sent you a check-in`
            : `You have ${requests.length} new check-ins`}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {requests.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 bg-white border border-[#E8E1D7] rounded-xl p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#2D2626]">{r.label} screener</p>
              <p className="text-xs text-[#5C544F] truncate">
                {r.note ? `"${r.note}"` : `From ${r.therapistName}`} · expires{" "}
                {new Date(r.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
            <Link href={`/screener/${r.magicToken}`}>
              <Button className="rounded-xl h-9 px-4 text-[13px] bg-[#9B7250] hover:bg-[#8B6B5D] text-white shrink-0">
                Start <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PatientPortal() {
  const { isSignedIn, isLoaded } = useAuth();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const sessions = useMySessions();
  const matches = useMyMatches();
  const screenerRequests = useMyScreenerRequests();
  const { data: therapists } = useListTherapists();

  if (!isLoaded || userLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (user && user.role !== "patient") return <Redirect to="/portal" />;

  const patientName = (user?.record as any)?.name ?? "there";
  const firstName = patientName !== "there" ? patientName.split(" ")[0] : "";

  const inProgress = (sessions ?? []).filter((s) => !s.endedAt);
  const completed = (sessions ?? []).filter((s) => !!s.endedAt);
  const matchedTherapistIds = new Set((matches ?? []).map((m) => m.therapistId));

  const therapistMap = useMemo(() => {
    const m = new Map<number, any>();
    (therapists ?? []).forEach((t: any) => m.set(t.id, t));
    return m;
  }, [therapists]);

  const enrichedMatches = (matches ?? [])
    .map((m) => ({ match: m, therapist: therapistMap.get(m.therapistId) }))
    .filter((m) => !!m.therapist)
    .slice(0, 5);

  const resumeSession = inProgress[0] ?? null;

  return (
    <div className="flex flex-col lg:flex-row gap-8 max-w-[1400px] mx-auto">
      <div className="flex-1 flex flex-col gap-8">
        {/* Greeting & CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-8 border border-border/50 shadow-sm">
          <div>
            <h1 className="font-serif text-3xl font-medium text-[#2D2626]">
              Welcome{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="text-[#5C544F] mt-1">
              {resumeSession
                ? "You have an intake in progress."
                : "Begin a conversational intake whenever you're ready."}
            </p>
          </div>
          <Link href={resumeSession ? `/intake/${resumeSession.id}` : "/intake/new"}>
            <Button className="rounded-xl h-12 px-6 text-[15px] font-medium bg-[#9B7250] hover:bg-[#8B6B5D]">
              {resumeSession ? "Resume Intake" : "Start Conversational Intake"}
            </Button>
          </Link>
        </div>

        {screenerRequests && screenerRequests.length > 0 && (
          <ScreenerRequestBanner requests={screenerRequests} />
        )}

        {/* Stats Grid (real data only) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            icon={<Clock className="h-4 w-4 text-[#9B7250]" />}
            label="In Progress"
            value={sessions == null ? "—" : String(inProgress.length)}
            subtitle={inProgress.length === 1 ? "intake session" : "intake sessions"}
          />
          <StatCard
            icon={<FileText className="h-4 w-4 text-[#9B7250]" />}
            label="Clinical Briefs"
            value={sessions == null ? "—" : String(completed.length)}
            subtitle="completed intakes"
          />
          <StatCard
            icon={<Users className="h-4 w-4 text-[#9B7250]" />}
            label="Active Matches"
            value={matches == null ? "—" : String(matchedTherapistIds.size)}
            subtitle="provider requests sent"
          />
        </div>

        {/* Resume in-progress session panel (only when one exists) */}
        {resumeSession && (
          <div className="bg-white rounded-2xl overflow-hidden border border-border/50 shadow-sm">
            <div className="p-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-12 w-12 rounded-full bg-[#F5EFE6] flex items-center justify-center shrink-0">
                  <PlayCircle className="h-5 w-5 text-[#9B7250]" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-[#2D2626] truncate">
                    {resumeSession.label ?? `Intake Session #${resumeSession.id}`}
                  </h3>
                  <p className="text-sm text-[#5C544F]">
                    Started{" "}
                    {new Date(resumeSession.startedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    • In progress
                  </p>
                </div>
              </div>
              <Link href={`/intake/${resumeSession.id}`}>
                <Button
                  variant="outline"
                  className="rounded-xl border-[#E8E1D7] text-[14px] font-medium h-10 shrink-0"
                >
                  Resume Dialogue
                </Button>
              </Link>
            </div>
          </div>
        )}

        <div className="mb-8">
          <SessionsList sessions={sessions} />
        </div>
      </div>

      {/* Right Sidebar - Live matches */}
      <div className="w-full lg:w-[340px] flex flex-col gap-6">
        <div className="bg-white rounded-2xl p-6 border border-border/50 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-2 w-2 rounded-full bg-[#9B7250]" />
            <h2 className="font-medium text-xs tracking-widest uppercase text-[#5C544F]">
              Your Provider Matches
            </h2>
          </div>

          {matches == null || (matches.length > 0 && therapists == null) ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-[#9B7250]" />
            </div>
          ) : enrichedMatches.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-[#5C544F] mb-4">
                Complete an intake to see provider recommendations.
              </p>
              <Link href="/therapists">
                <Button
                  variant="ghost"
                  className="w-full text-[#9B7250] hover:text-[#8B6B5D] hover:bg-[#F5EFE6]"
                >
                  Browse Directory
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {enrichedMatches.map((entry, idx) => {
                  const t = entry.therapist;
                  const initials = t.name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .slice(0, 2);
                  return (
                    <React.Fragment key={entry.match.id}>
                      <Link href={`/therapists/${t.id}`}>
                        <div className="group cursor-pointer rounded-xl p-4 border border-transparent hover:border-[#E8E1D7] hover:bg-[#F8F9FA] transition-all">
                          <div className="flex items-center gap-4 mb-3">
                            <Avatar className="h-12 w-12 border border-border/50">
                              <AvatarImage
                                src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                  t.name,
                                )}&backgroundColor=f0e6e6&textColor=2d2626`}
                              />
                              <AvatarFallback>{initials}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <h3 className="font-medium text-[#2D2626] text-[15px] group-hover:text-[#9B7250] transition-colors truncate">
                                {t.name}
                              </h3>
                              <p className="text-xs text-[#5C544F] truncate">
                                {t.providerProfile?.title ?? "Provider"}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center rounded-full bg-[#F5EFE6] px-2.5 py-1 text-[10px] font-medium text-[#9B7250] capitalize">
                              {entry.match.status === "accepted" ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Accepted
                                </>
                              ) : (
                                entry.match.status
                              )}
                            </span>
                            {(t.specialties ?? [])
                              .slice(0, 1)
                              .map((s: string) => (
                                <span
                                  key={s}
                                  className="inline-flex items-center rounded-full bg-[#F8F9FA] border border-[#E8E1D7] px-2.5 py-1 text-[10px] font-medium text-[#5C544F] capitalize"
                                >
                                  {s.replace(/-/g, " ")}
                                </span>
                              ))}
                          </div>
                        </div>
                      </Link>
                      {idx < enrichedMatches.length - 1 && (
                        <div className="h-[1px] w-full bg-border/50" />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              <Link href="/therapists">
                <Button
                  variant="ghost"
                  className="w-full mt-4 text-[#9B7250] hover:text-[#8B6B5D] hover:bg-[#F5EFE6]"
                >
                  Browse Directory
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-border/50 shadow-sm flex flex-col">
      <div className="flex items-center gap-2 text-sm font-medium text-[#5C544F] mb-4">
        {icon}
        {label}
      </div>
      <div className="mt-auto">
        <p className="font-serif text-3xl font-medium text-[#2D2626]">{value}</p>
        <p className="text-xs text-[#5C544F] mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

function SessionsList({ sessions }: { sessions: Session[] | null }) {
  if (sessions == null) return null;
  if (sessions.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-serif text-2xl font-medium text-[#2D2626]">Recent Sessions</h2>
        <Link
          href="/sessions"
          className="text-sm font-medium text-[#9B7250] hover:text-[#8B6B5D]"
        >
          View all
        </Link>
      </div>
      {sessions.slice(0, 3).map((session) => {
        const isComplete = !!session.endedAt;
        const date = new Date(session.startedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        return (
          <div
            key={session.id}
            className="bg-white border border-border/50 rounded-xl p-5 flex items-center justify-between hover:border-[#9B7250]/50 transition-colors cursor-pointer"
            onClick={() =>
              isComplete
                ? (window.location.href = `/intake/${session.id}/brief`)
                : (window.location.href = `/intake/${session.id}`)
            }
          >
            <div className="flex items-center gap-4">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                  isComplete
                    ? "bg-[#F5EFE6] text-[#9B7250]"
                    : "bg-[#F8F9FA] border border-[#E8E1D7] text-[#5C544F]"
                }`}
              >
                {isComplete ? <FileText className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              </div>
              <div>
                <p className="font-medium text-[#2D2626] text-[15px]">
                  {session.label ?? `Intake Session #${session.id}`}
                </p>
                <p className="text-xs text-[#5C544F] mt-0.5">
                  {date} • {isComplete ? "Completed" : "In progress"}
                </p>
              </div>
            </div>
            {isComplete ? (
              <span className="text-sm font-medium text-[#9B7250] flex items-center gap-1">
                View Brief <ArrowRight className="h-4 w-4" />
              </span>
            ) : (
              <span className="text-sm font-medium text-[#5C544F] flex items-center gap-1">
                Resume <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

