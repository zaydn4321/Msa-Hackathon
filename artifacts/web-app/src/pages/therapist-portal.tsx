import React, { useState, useEffect, useRef } from "react";
import { Link, Redirect } from "wouter";
import { useAuth } from "@clerk/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, User, Search, Plus, Activity, FileText, CheckCircle2, ChevronRight, MessageSquare, Download, AlertTriangle, TrendingUp, Inbox, ClipboardCheck, ClipboardList } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ScreenerRequestModal } from "@/components/screener-request-modal";
import { ScreenerActivityPanel } from "@/components/screener-activity-panel";

type SessionEntry = {
  session: {
    id: number;
    label: string | null;
    startedAt: string;
    endedAt: string | null;
    clinicalBrief: any | null;
  };
  patient: {
    id: number;
    name: string;
    demographics: any;
    createdAt: string;
  } | null;
  biometrics: any[];
};

type ScreenerScore = {
  score: number;
  maxScore: number;
  severity: string;
  rationale?: string;
  approvedAt?: string | null;
} | null;

type IncomingMatch = {
  match: {
    id: number;
    patientId: number;
    therapistId: number;
    sessionId: number;
    status: "pending" | "accepted" | "declined";
    message: string | null;
    createdAt: string;
  };
  patient: { id: number; name: string } | null;
  session: {
    id: number;
    startedAt: string;
    clinicalBrief: any | null;
    phq9: ScreenerScore;
    gad7: ScreenerScore;
  } | null;
};

function ScreenerCard({
  label,
  score,
  approved,
  loading,
  onApprove,
}: {
  label: string;
  score: ScreenerScore;
  approved: boolean;
  loading: boolean;
  onApprove: (note: string | undefined, approve: boolean) => void;
}) {
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  if (!score) {
    return (
      <div className="rounded-xl border border-[#E8E1D7] bg-[#FAFAF9] p-3">
        <p className="text-[11px] font-medium text-[#5C544F]">{label}</p>
        <p className="text-xs text-[#A09890] mt-1">Not scored yet</p>
      </div>
    );
  }
  const existingNote = (score as ScreenerScore & { approvalNote?: string | null }).approvalNote;
  return (
    <div className={`rounded-xl border p-3 ${approved ? "border-emerald-200 bg-emerald-50/40" : "border-[#E8E1D7] bg-white"}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-medium text-[#5C544F]">{label}</p>
        <p className="font-serif text-lg text-[#2D2626] leading-none">
          {score.score}
          <span className="text-[10px] font-sans text-[#A09890]">/{score.maxScore}</span>
        </p>
      </div>
      <p className="text-[11px] text-[#5C544F] mb-2">{score.severity}</p>
      {approved && existingNote && (
        <p className="text-[11px] text-[#2D2626] italic mb-2">"{existingNote}"</p>
      )}
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant={approved ? "outline" : "default"}
          disabled={loading}
          onClick={() => setConfirmOpen(true)}
          className={`flex-1 h-7 text-[11px] rounded-md ${
            approved
              ? "border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50"
              : "bg-[#2D2626] hover:bg-black text-white"
          }`}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : approved ? (
            <><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</>
          ) : (
            <><ClipboardCheck className="h-3 w-3 mr-1" /> {showNote ? "Approve with note" : "Approve"}</>
          )}
        </Button>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {approved ? `Un-approve ${label}?` : `Approve ${label} score?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {approved
                ? `This will clear your prior approval of this baseline ${label} score. You can re-approve at any time.`
                : `Confirming will mark this ${label} baseline as clinically reviewed (${score.score}/${score.maxScore} · ${score.severity}) and stamp it with your name and the current time.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!approved && (
            <Textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (!showNote) setShowNote(true);
              }}
              placeholder="Optional clinical note (e.g. 'Reviewed with patient on intake call')"
              className="text-[12px] min-h-[60px] border-[#E8E1D7]"
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onApprove(note ? note : undefined, !approved);
                setConfirmOpen(false);
                if (approved) {
                  setShowNote(false);
                  setNote("");
                }
              }}
            >
              {approved ? "Un-approve" : "Confirm approval"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function TherapistPortal() {
  const { isSignedIn, isLoaded } = useAuth();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [entries, setEntries] = useState<SessionEntry[]>([]);
  const [therapistName, setTherapistName] = useState("");
  const [therapistId, setTherapistId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [incomingMatches, setIncomingMatches] = useState<IncomingMatch[]>([]);
  const [pendingApproval, setPendingApproval] = useState<string | null>(null);
  const [requestModal, setRequestModal] = useState<{ patientId: number; patientName: string } | null>(null);
  const [activityKey, setActivityKey] = useState(0);
  const { toast } = useToast();
  const seenMatchIdsRef = useRef<Set<number> | null>(null);
  const [stats, setStats] = useState<{
    totalPatients: number;
    highPriority: number;
    pendingIntakes: number;
    priorityAlerts: number;
    sessionVolumeSeries: { date: string; count: number }[];
    checklist: { id: string; label: string; due: "today" | "tomorrow" | "later"; href?: string }[];
    recentMatches: { id: number; patientName: string; status: string; createdAt: string; sessionId: number }[];
    dueRescreens: {
      patientId: number;
      patientName: string;
      instrument: "phq9" | "gad7";
      instrumentLabel: string;
      daysSince: number | null;
      lastApprovedAt: string | null;
      hasOpenRequest: boolean;
      sessionId: number | null;
    }[];
    rescreenIntervalDays: number;
  } | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const refreshMatches = () => {
    fetch("/api/therapist/my-matches", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { matches: [] }))
      .then((data) => {
        const next: IncomingMatch[] = data.matches ?? [];
        // Notify on newly-arrived pending matches.
        if (seenMatchIdsRef.current !== null) {
          const seen = seenMatchIdsRef.current;
          for (const entry of next) {
            if (!seen.has(entry.match.id) && entry.match.status === "pending") {
              toast({
                title: "New patient match request",
                description: `${entry.patient?.name ?? "A patient"} is requesting to connect.`,
              });
            }
          }
        }
        seenMatchIdsRef.current = new Set(next.map((m) => m.match.id));
        setIncomingMatches(next);
      })
      .catch(() => {});
    fetch("/api/therapist/dashboard-stats", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setStats(data))
      .catch(() => {});
  };

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/therapist/my-patients", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.patients ?? []);
        setTherapistName(data.therapist?.name ?? "");
        setTherapistId(data.therapist?.id ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    refreshMatches();
    // Live updates: poll every 4s, and refresh immediately when the tab regains focus.
    const interval = setInterval(refreshMatches, 4000);
    const onFocus = () => refreshMatches();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [isSignedIn]);

  const updateMatch = async (
    matchId: number,
    body: {
      phq9Approved?: boolean;
      gad7Approved?: boolean;
      phq9Note?: string;
      gad7Note?: string;
      status?: "accepted" | "declined";
    },
    key: string,
  ) => {
    setPendingApproval(key);
    try {
      const res = await fetch(`/api/therapist/matches/${matchId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) refreshMatches();
    } finally {
      setPendingApproval(null);
    }
  };

  const runBulkRescreen = async () => {
    setBulkBusy(true);
    try {
      const res = await fetch("/api/therapist/screener-requests/bulk-due", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: `Re-screen run: ${data.sent} sent`,
          description:
            data.skipped > 0
              ? `${data.skipped} already had an open request — skipped.`
              : `All eligible patients notified.`,
        });
        setActivityKey((k) => k + 1);
        refreshMatches();
      } else {
        toast({ title: "Bulk re-screen failed", variant: "destructive" });
      }
    } finally {
      setBulkBusy(false);
    }
  };

  if (!isLoaded || userLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (user && user.role !== "therapist") return <Redirect to="/portal" />;

  const lastName = therapistName ? therapistName.split(" ").pop() : "";

  return (
    <div className="flex flex-col xl:flex-row gap-8 max-w-[1600px] mx-auto">
      <div className="flex-1 flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-medium text-[#2D2626]">
              Welcome back, Dr. {lastName}.
            </h1>
            <p className="text-[#5C544F] mt-1 flex items-center gap-1.5">
              {stats && stats.priorityAlerts > 0 ? (
                <>You have <span className="font-medium text-[#9B7250]">{stats.priorityAlerts} priority alert{stats.priorityAlerts === 1 ? "" : "s"}</span> today.</>
              ) : (
                <>You're all caught up today.</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {stats && stats.dueRescreens && stats.dueRescreens.filter((d) => !d.hasOpenRequest).length > 0 && (
              <Button
                variant="outline"
                onClick={runBulkRescreen}
                disabled={bulkBusy}
                className="rounded-xl h-10 border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 font-medium"
                title={`${stats.rescreenIntervalDays}-day cadence`}
              >
                {bulkBusy ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ClipboardList className="h-4 w-4 mr-2" />
                )}
                Re-screen all due ({stats.dueRescreens.filter((d) => !d.hasOpenRequest).length})
              </Button>
            )}
            <Button variant="outline" className="rounded-xl h-10 border-[#E8E1D7] text-[#2D2626] font-medium hidden sm:flex">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button className="rounded-xl h-10 bg-[#9B7250] hover:bg-[#8B6B5D] font-medium">
              <Plus className="h-4 w-4 mr-2" />
              New Patient
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-2xl border border-border/50 shadow-sm">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-[#5C544F] uppercase tracking-wider">Total Patients</span>
                <TrendingUp className="h-4 w-4 text-[#9B7250]" />
              </div>
              <p className="font-serif text-[2.5rem] font-medium text-[#2D2626] leading-none">{stats?.totalPatients ?? 0}</p>
            </CardContent>
          </Card>
          <Card className={`rounded-2xl border shadow-sm ${(stats?.highPriority ?? 0) > 0 ? "border-red-100 bg-[#FFF8F8]" : "border-border/50"}`}>
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-4">
                <span className={`text-xs font-medium uppercase tracking-wider ${(stats?.highPriority ?? 0) > 0 ? "text-red-900/70" : "text-[#5C544F]"}`}>High Priority</span>
                <AlertTriangle className={`h-4 w-4 ${(stats?.highPriority ?? 0) > 0 ? "text-red-500" : "text-[#A09890]"}`} />
              </div>
              <p className={`font-serif text-[2.5rem] font-medium leading-none ${(stats?.highPriority ?? 0) > 0 ? "text-red-700" : "text-[#2D2626]"}`}>{stats?.highPriority ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border/50 shadow-sm">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-[#5C544F] uppercase tracking-wider">Pending Intakes</span>
                <FileText className="h-4 w-4 text-[#9B7250]" />
              </div>
              <p className="font-serif text-[2.5rem] font-medium text-[#2D2626] leading-none">{stats?.pendingIntakes ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border/50 shadow-sm">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[#5C544F] uppercase tracking-wider">Match Volume · 7d</span>
              </div>
              <div className="mt-auto">
                {(() => {
                  const series = stats?.sessionVolumeSeries ?? [];
                  const max = Math.max(1, ...series.map((p) => p.count));
                  const points = series.length > 0
                    ? series.map((p, i) => `${(i / Math.max(1, series.length - 1)) * 100},${30 - (p.count / max) * 28}`).join(" L")
                    : "0,30 L100,30";
                  return (
                    <svg viewBox="0 0 100 30" className="w-full h-10 text-[#9B7250]" preserveAspectRatio="none">
                      <path d={`M${points}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                    </svg>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Incoming Patient Matches */}
        {incomingMatches.length > 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-[#9B7250]" />
              <h2 className="font-serif text-2xl font-medium text-[#2D2626]">Incoming patient matches</h2>
              <span className="ml-2 inline-flex items-center rounded-full bg-[#F5EFE6] px-2.5 py-0.5 text-[11px] font-medium text-[#9B7250] border border-[#E8E1D7]">
                {incomingMatches.filter((m) => m.match.status === "pending").length} pending
              </span>
            </div>
            <div className="grid gap-4">
              {incomingMatches.map((entry) => {
                const m = entry.match;
                const sess = entry.session;
                const brief = sess?.clinicalBrief;
                const phq9 = sess?.phq9 ?? null;
                const gad7 = sess?.gad7 ?? null;
                const phq9Approved = !!phq9?.approvedAt;
                const gad7Approved = !!gad7?.approvedAt;
                return (
                  <div key={m.id} className="bg-white rounded-2xl border border-[#E8E1D7] shadow-sm overflow-hidden">
                    <div className="p-5 flex items-start justify-between gap-4 border-b border-[#E8E1D7] bg-[#FAFAF9]">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 border border-[#E8E1D7]">
                          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${entry.patient?.name ?? 'Patient'}&backgroundColor=f0e6e6&textColor=2d2626`} />
                          <AvatarFallback>{entry.patient?.name?.charAt(0) ?? 'P'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-medium text-[#2D2626] text-[16px]">{entry.patient?.name ?? "Anonymous patient"}</h3>
                          <p className="text-xs text-[#5C544F]">
                            Match requested {new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            {brief?.clinicalProfile && (
                              <> · <span className="capitalize">{String(brief.clinicalProfile).replace(/-/g, " ")}</span></>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                            m.status === "accepted"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : m.status === "declined"
                              ? "bg-red-50 text-red-700 border-red-100"
                              : "bg-amber-50 text-amber-700 border-amber-100"
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 grid md:grid-cols-3 gap-5">
                      {/* Brief preview */}
                      <div className="md:col-span-2 space-y-3">
                        <p className="text-[10px] uppercase tracking-wider font-mono text-[#5C544F]">Intake brief</p>
                        {brief ? (
                          <>
                            <div>
                              <p className="text-[11px] font-medium text-[#5C544F] mb-1">Subjective</p>
                              <p className="text-sm text-[#2D2626] leading-relaxed line-clamp-4">{brief.subjective}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-medium text-[#5C544F] mb-1">Assessment</p>
                              <p className="text-sm text-[#2D2626] leading-relaxed line-clamp-3">{brief.assessment}</p>
                            </div>
                            <Link href={`/therapist-portal/sessions/${m.sessionId}`} className="inline-block">
                              <Button variant="outline" size="sm" className="rounded-lg border-[#E8E1D7] text-[#2D2626] mt-1">
                                Open full brief <ChevronRight className="h-3.5 w-3.5 ml-1" />
                              </Button>
                            </Link>
                          </>
                        ) : (
                          <p className="text-sm text-[#5C544F]">Brief not yet available.</p>
                        )}
                      </div>

                      {/* Screeners */}
                      <div className="space-y-3">
                        <p className="text-[10px] uppercase tracking-wider font-mono text-[#5C544F]">Screeners</p>
                        <ScreenerCard
                          label="PHQ-9"
                          score={phq9}
                          approved={phq9Approved}
                          loading={pendingApproval === `phq9-${m.id}`}
                          onApprove={(note, approve) =>
                            updateMatch(
                              m.id,
                              { phq9Approved: approve, phq9Note: note },
                              `phq9-${m.id}`,
                            )
                          }
                        />
                        <ScreenerCard
                          label="GAD-7"
                          score={gad7}
                          approved={gad7Approved}
                          loading={pendingApproval === `gad7-${m.id}`}
                          onApprove={(note, approve) =>
                            updateMatch(
                              m.id,
                              { gad7Approved: approve, gad7Note: note },
                              `gad7-${m.id}`,
                            )
                          }
                        />
                      </div>
                    </div>

                    {m.status === "pending" && (
                      <div className="px-5 pb-5 flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg border-[#E8E1D7] text-[#5C544F]"
                          disabled={pendingApproval === `decline-${m.id}`}
                          onClick={() => updateMatch(m.id, { status: "declined" }, `decline-${m.id}`)}
                        >
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          className="rounded-lg bg-[#9B7250] hover:bg-[#8B6B5D] text-white"
                          disabled={pendingApproval === `accept-${m.id}`}
                          onClick={() => updateMatch(m.id, { status: "accepted" }, `accept-${m.id}`)}
                        >
                          {pendingApproval === `accept-${m.id}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>Accept patient</>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Patient List */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-1 bg-white border border-[#E8E1D7] rounded-xl p-1 overflow-x-auto hide-scrollbar">
              <button className="px-4 py-1.5 text-sm font-medium rounded-lg bg-[#F5EFE6] text-[#9B7250] whitespace-nowrap">All Patients</button>
              <button className="px-4 py-1.5 text-sm font-medium rounded-lg text-[#5C544F] hover:bg-black/5 whitespace-nowrap">Active</button>
              <button className="px-4 py-1.5 text-sm font-medium rounded-lg text-[#5C544F] hover:bg-black/5 whitespace-nowrap">New Intakes</button>
              <button className="px-4 py-1.5 text-sm font-medium rounded-lg text-[#5C544F] hover:bg-black/5 whitespace-nowrap">Needs Follow-up</button>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search patients..." className="pl-9 h-10 rounded-xl border-[#E8E1D7]" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {entries.length === 0 ? (
              <div className="col-span-2 p-12 text-center border border-border/50 rounded-2xl bg-white">
                <User className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-medium text-foreground mb-2">No patients assigned yet</h3>
                <p className="text-sm text-muted-foreground">Patients will appear here once they complete their intake and are matched with you.</p>
              </div>
            ) : (
              entries.map((entry, i) => {
                const dueForPatient = (stats?.dueRescreens ?? []).filter(
                  (d) => entry.patient && d.patientId === entry.patient.id,
                );
                return (
                <div key={entry.session.id} className="bg-white rounded-2xl border border-border/50 shadow-sm p-5 hover:border-[#9B7250]/30 transition-colors group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-border/50">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${entry.patient?.name ?? 'Anon'}&backgroundColor=f0e6e6&textColor=2d2626`} />
                        <AvatarFallback>{entry.patient?.name?.charAt(0) ?? 'U'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-medium text-[#2D2626] text-[15px]">{entry.patient?.name ?? "Anonymous Patient"}</h3>
                        <p className="text-xs text-[#5C544F] font-mono">ID: {10000 + (entry.patient?.id ?? i)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {entry.session.endedAt ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-100">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-100">
                          Intake Pending
                        </span>
                      )}
                      {dueForPatient.map((d) => (
                        <span
                          key={d.instrument}
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border uppercase tracking-wide ${
                            d.hasOpenRequest
                              ? "bg-blue-50 text-blue-700 border-blue-100"
                              : "bg-amber-100 text-amber-800 border-amber-200"
                          }`}
                          title={
                            d.lastApprovedAt
                              ? `Last approved ${new Date(d.lastApprovedAt).toLocaleDateString()}`
                              : "Never approved"
                          }
                        >
                          {d.instrumentLabel} {d.hasOpenRequest ? "Sent" : "Due"}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-medium text-[#5C544F] mb-1">Last Session</p>
                      <p className="text-sm text-[#2D2626]">
                        {new Date(entry.session.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-medium text-[#5C544F] mb-1">Clinical Profile</p>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[11px] bg-[#F5EFE6] text-[#9B7250] px-1.5 py-0.5 rounded">
                          #{entry.session.clinicalBrief?.clinicalProfile?.split('-')[0] ?? 'general'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t border-[#E8E1D7]">
                    <Link href={`/therapist-portal/sessions/${entry.session.id}`} className="flex-1">
                      <Button variant="outline" className="w-full h-9 rounded-lg border-[#E8E1D7] text-[13px] font-medium text-[#2D2626]">
                        Open Brief
                      </Button>
                    </Link>
                    {entry.patient && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setRequestModal({
                            patientId: entry.patient!.id,
                            patientName: entry.patient!.name ?? "this patient",
                          })
                        }
                        className="h-9 rounded-lg border-[#E8E1D7] text-[13px] font-medium text-[#2D2626]"
                      >
                        <ClipboardList className="h-3.5 w-3.5 mr-1.5" /> Re-screen
                      </Button>
                    )}
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg border-[#E8E1D7] text-[#5C544F]">
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>
                  {entry.patient && (
                    <ScreenerActivityPanel
                      patientId={entry.patient.id}
                      patientName={entry.patient.name}
                      refreshKey={activityKey}
                      currentTherapistId={therapistId}
                      onChanged={() => {
                        setActivityKey((k) => k + 1);
                        refreshMatches();
                      }}
                    />
                  )}
                </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-full xl:w-[320px] flex flex-col gap-6">
        <Card className="rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          <div className="bg-[#FAFAF9] border-b border-[#E8E1D7] px-5 py-4 flex items-center justify-between">
            <h3 className="font-medium text-[#2D2626]">Checklist</h3>
            <span className="text-xs font-medium bg-[#F5EFE6] text-[#9B7250] px-2 py-0.5 rounded-full">
              {(stats?.checklist?.length ?? 0)} pending
            </span>
          </div>
          <CardContent className="p-0">
            {stats && stats.checklist.length > 0 ? (
              <div className="divide-y divide-[#E8E1D7]">
                {stats.checklist.slice(0, 6).map((item) => {
                  const dueLabel = item.due === "today" ? "Due Today" : item.due === "tomorrow" ? "Tomorrow" : "Later";
                  const dueColor = item.due === "today" ? "text-red-600" : "text-[#9B7250]";
                  const rescreenMatch = item.id.match(/^rescreen-(\d+)-(phq9|gad7)$/);
                  if (rescreenMatch) {
                    const pid = Number(rescreenMatch[1]);
                    const instrument = rescreenMatch[2] as "phq9" | "gad7";
                    const sendKey = `checklist-send-${item.id}`;
                    return (
                      <div
                        key={item.id}
                        className="p-4 hover:bg-black/5 transition-colors flex items-start gap-3"
                      >
                        <div className="h-5 w-5 rounded border border-[#D5CFC6] mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[#2D2626] leading-tight mb-1">{item.label}</p>
                          <span className={`text-[10px] font-bold uppercase ${dueColor}`}>{dueLabel}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingApproval === sendKey}
                          onClick={async () => {
                            setPendingApproval(sendKey);
                            try {
                              const res = await fetch(`/api/therapist/screener-requests`, {
                                method: "POST",
                                credentials: "include",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ patientId: pid, instruments: [instrument] }),
                              });
                              if (res.ok) {
                                toast({ title: "Re-screen sent" });
                                setActivityKey((k) => k + 1);
                                refreshMatches();
                              } else {
                                toast({ title: "Could not send", variant: "destructive" });
                              }
                            } finally {
                              setPendingApproval(null);
                            }
                          }}
                          className="h-7 text-[10px] rounded-md border-[#E8E1D7] px-2 shrink-0"
                        >
                          {pendingApproval === sendKey ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Send"
                          )}
                        </Button>
                      </div>
                    );
                  }
                  const inner = (
                    <div className="p-4 hover:bg-black/5 transition-colors cursor-pointer flex items-start gap-3">
                      <div className="h-5 w-5 rounded border border-[#D5CFC6] mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[13px] font-medium text-[#2D2626] leading-tight mb-1">{item.label}</p>
                        <span className={`text-[10px] font-bold uppercase ${dueColor}`}>{dueLabel}</span>
                      </div>
                    </div>
                  );
                  return item.href ? (
                    <Link key={item.id} href={item.href}>{inner}</Link>
                  ) : (
                    <div key={item.id}>{inner}</div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500/60 mx-auto mb-2" />
                <p className="text-sm text-[#5C544F]">Nothing on your list right now.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          <div className="bg-[#FAFAF9] border-b border-[#E8E1D7] px-5 py-4 flex items-center justify-between">
            <h3 className="font-medium text-[#2D2626]">Recent activity</h3>
            <Activity className="h-4 w-4 text-[#5C544F]" />
          </div>
          <CardContent className="p-0">
            {stats && stats.recentMatches.length > 0 ? (
              <div className="divide-y divide-[#E8E1D7]">
                {stats.recentMatches.map((m) => {
                  const dot =
                    m.status === "accepted" ? "bg-emerald-500" :
                    m.status === "declined" ? "bg-red-400" : "bg-amber-500";
                  return (
                    <Link key={m.id} href={`/therapist-portal/sessions/${m.sessionId}`}>
                      <div className="p-4 hover:bg-black/5 transition-colors cursor-pointer">
                        <p className="text-xs font-medium text-[#9B7250] mb-1">
                          {new Date(m.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-[14px] font-medium text-[#2D2626]">{m.patientName} <span className="text-[#5C544F] font-normal">· match {m.status}</span></p>
                          <span className={`h-2 w-2 rounded-full ${dot}`} />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-[#5C544F]">No recent match activity.</div>
            )}
          </CardContent>
        </Card>
      </div>
      {requestModal && (
        <ScreenerRequestModal
          patientId={requestModal.patientId}
          patientName={requestModal.patientName}
          onClose={() => setRequestModal(null)}
          onCreated={() => setActivityKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
