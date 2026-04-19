import React, { useState, useEffect } from "react";
import { Link, Redirect } from "wouter";
import { useAuth } from "@clerk/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, HeartPulse, Activity, FileText, ChevronDown, ChevronUp, User, ArrowRight } from "lucide-react";

type BiometricReading = {
  id: number;
  metric: string;
  value: number;
  recordedAt: string;
};

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
  biometrics: BiometricReading[];
};

function BiometricSummary({ biometrics }: { biometrics: BiometricReading[] }) {
  const hrReadings = biometrics.filter((b) => b.metric === "HR").map((b) => b.value);
  const hrvReadings = biometrics.filter((b) => b.metric === "HRV").map((b) => b.value);

  if (hrReadings.length === 0) return <p className="text-xs text-muted-foreground">No biometric data recorded</p>;

  const avgHr = Math.round(hrReadings.reduce((a, b) => a + b, 0) / hrReadings.length);
  const peakHr = Math.max(...hrReadings);
  const avgHrv = hrvReadings.length > 0 ? Math.round(hrvReadings.reduce((a, b) => a + b, 0) / hrvReadings.length) : null;

  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex items-center gap-2">
        <HeartPulse className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm">
          <span className="font-medium text-foreground">{avgHr}</span>
          <span className="text-muted-foreground"> avg bpm</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <HeartPulse className="h-4 w-4 text-destructive/70 shrink-0" />
        <span className="text-sm">
          <span className="font-medium text-foreground">{peakHr}</span>
          <span className="text-muted-foreground"> peak bpm</span>
        </span>
      </div>
      {avgHrv !== null && (
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm">
            <span className="font-medium text-foreground">{avgHrv}</span>
            <span className="text-muted-foreground"> ms HRV</span>
          </span>
        </div>
      )}
      <span className="text-xs text-muted-foreground self-center">({hrReadings.length} readings)</span>
    </div>
  );
}

function HrChart({ biometrics }: { biometrics: BiometricReading[] }) {
  const hrReadings = biometrics
    .filter((b) => b.metric === "HR")
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  if (hrReadings.length < 2) return null;

  const values = hrReadings.map((b) => b.value);
  const min = Math.min(...values) - 5;
  const max = Math.max(...values) + 5;
  const range = max - min;
  const w = 300;
  const h = 80;

  const points = hrReadings.map((b, i) => {
    const x = (i / (hrReadings.length - 1)) * w;
    const y = h - ((b.value - min) / range) * h;
    return `${x},${y}`;
  });

  return (
    <div className="mt-3">
      <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Heart rate over session</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16 text-primary" preserveAspectRatio="none">
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>{min + 5} bpm</span>
        <span>{max - 5} bpm peak</span>
      </div>
    </div>
  );
}

function SessionCard({ entry }: { entry: SessionEntry }) {
  const [expanded, setExpanded] = useState(false);
  const { session, patient, biometrics } = entry;
  const brief = session.clinicalBrief;
  const date = new Date(session.startedAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
  const isComplete = !!session.endedAt;

  return (
    <Card className="bg-card border-border/50">
      <CardContent className="p-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left p-5 flex items-start gap-4"
        >
          <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {patient?.name ?? "Anonymous patient"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {date} — {isComplete ? "Completed" : "In progress"}
              {brief?.clinicalProfile && (
                <span className="ml-2 font-mono bg-muted px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">
                  {brief.clinicalProfile}
                </span>
              )}
            </p>
            {isComplete && <BiometricSummary biometrics={biometrics} />}
          </div>
          <div className="text-muted-foreground shrink-0 mt-0.5">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        {expanded && (
          <div className="border-t border-border/50 px-5 py-5 space-y-5">
            {/* Biometric chart */}
            {biometrics.length > 1 && (
              <div>
                <HrChart biometrics={biometrics} />
              </div>
            )}

            {/* SOAP brief */}
            {brief ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">SOAP Clinical Brief</p>
                </div>
                {[
                  { label: "Subjective", value: brief.subjective },
                  { label: "Assessment", value: brief.assessment },
                  { label: "Plan", value: brief.plan },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                    <p className="text-sm text-foreground leading-relaxed">{value}</p>
                  </div>
                ))}
                {brief.objective && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Objective — Biometrics</p>
                    <div className="text-sm text-foreground space-y-1">
                      {brief.objective.averageHr && (
                        <p>Average HR: <span className="font-medium">{Math.round(brief.objective.averageHr)} bpm</span></p>
                      )}
                      {brief.objective.peakHr && (
                        <p>Peak HR: <span className="font-medium">{brief.objective.peakHr} bpm</span></p>
                      )}
                      {brief.objective.averageHrv && (
                        <p>Average HRV: <span className="font-medium">{Math.round(brief.objective.averageHrv)} ms</span></p>
                      )}
                      {brief.objective.biometricSubtextEvents?.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/40">
                          <p className="text-xs text-muted-foreground mb-2">Stress events during session:</p>
                          {brief.objective.biometricSubtextEvents.slice(0, 3).map((event: any, i: number) => (
                            <div key={i} className="text-xs text-muted-foreground leading-relaxed mb-1">
                              <span className="text-destructive/70 font-medium">+{Math.round(event.spikePercent)}% HR</span> — "{event.text}"
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isComplete ? "Brief not yet generated." : "Session still in progress — brief will appear after the session ends."}
              </p>
            )}

            <div className="flex gap-3 pt-2 border-t border-border/40">
              <Link href={`/intake/${session.id}/brief`}>
                <button className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  Full brief <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TherapistPortal() {
  const { isSignedIn, isLoaded } = useAuth();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [entries, setEntries] = useState<SessionEntry[]>([]);
  const [therapistName, setTherapistName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/therapist/my-patients", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load patients");
        return r.json();
      })
      .then((data) => {
        setEntries(data.patients ?? []);
        setTherapistName(data.therapist?.name ?? "");
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [isSignedIn]);

  if (!isLoaded || userLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (user && user.role !== "therapist") return <Redirect to="/portal" />;

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b border-border/50 px-4 py-8 md:px-8">
        <div className="container max-w-screen-xl mx-auto">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Provider dashboard</p>
          <h1 className="font-serif text-4xl font-medium text-foreground">
            {therapistName ? therapistName : "Your dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            All patients assigned to you — with intake session details, SOAP briefs, and biometric analysis.
          </p>
        </div>
      </div>

      <div className="flex-1 px-4 py-10 md:px-8">
        <div className="container max-w-screen-xl mx-auto max-w-3xl">

          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading patient data…
            </div>
          )}

          {error && (
            <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-5 text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading && !error && entries.length === 0 && (
            <div className="border border-border/50 rounded-xl p-10 text-center">
              <User className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-medium text-foreground mb-2">No patients assigned yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                When patients complete intake sessions and are matched to you, they'll appear here with their full session data.
              </p>
            </div>
          )}

          {!loading && !error && entries.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-serif text-xl font-medium text-foreground">
                  {entries.length} {entries.length === 1 ? "patient" : "patients"}
                </h2>
                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  {entries.filter((e) => !!e.session.endedAt).length} completed
                </p>
              </div>
              {entries.map((entry, i) => (
                <SessionCard key={`${entry.session.id}-${i}`} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
