import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetSessionBrief,
  getGetSessionBriefQueryKey,
} from "@workspace/api-client-react";
import {
  Loader2,
  FileText,
  ChevronLeft,
  Activity,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

type Match = {
  match: {
    id: number;
    sessionId: number;
    status: string;
    createdAt: string;
  };
  patient: { id: number; name: string; demographics: any; createdAt: string } | null;
  session: {
    id: number;
    label: string | null;
    startedAt: string;
    endedAt: string | null;
    clinicalBrief: any;
    phq9: any;
    gad7: any;
  } | null;
};

type Biometric = { id: number; metric: string; value: number; recordedAt: string };

function severity(score: number, kind: "phq9" | "gad7") {
  if (kind === "phq9") {
    if (score >= 20) return { label: "Severe", color: "bg-red-100 text-red-700" };
    if (score >= 15) return { label: "Moderately severe", color: "bg-amber-100 text-amber-700" };
    if (score >= 10) return { label: "Moderate", color: "bg-amber-50 text-amber-600" };
    if (score >= 5) return { label: "Mild", color: "bg-emerald-50 text-emerald-700" };
    return { label: "Minimal", color: "bg-emerald-50 text-emerald-700" };
  }
  if (score >= 15) return { label: "Severe", color: "bg-red-100 text-red-700" };
  if (score >= 10) return { label: "Moderate", color: "bg-amber-50 text-amber-600" };
  if (score >= 5) return { label: "Mild", color: "bg-emerald-50 text-emerald-700" };
  return { label: "Minimal", color: "bg-emerald-50 text-emerald-700" };
}

export default function TherapistPortalSession() {
  const params = useParams();
  const sessionId = Number(params.sessionId);

  const { data: session, isLoading } = useGetSessionBrief(sessionId, {
    query: { queryKey: getGetSessionBriefQueryKey(sessionId), enabled: !!sessionId },
  });

  // Look up patient + screeners via the therapist's match list (the only
  // endpoint that returns patient info to a therapist for this session).
  const [matchEntry, setMatchEntry] = useState<Match | null | undefined>(undefined);
  const [biometrics, setBiometrics] = useState<Biometric[]>([]);

  useEffect(() => {
    if (!sessionId) return;
    fetch("/api/therapist/my-matches", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const list: Match[] = Array.isArray(d?.matches) ? d.matches : [];
        setMatchEntry(list.find((m) => m.session?.id === sessionId) ?? null);
      })
      .catch(() => setMatchEntry(null));

    fetch(`/api/sessions/${sessionId}/biometrics`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setBiometrics(Array.isArray(d) ? d : []))
      .catch(() => setBiometrics([]));
  }, [sessionId]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[100dvh]">
        <p className="text-muted-foreground">Session not found.</p>
        <Link href="/therapist-portal">
          <Button variant="outline" className="mt-4">
            Back to portal
          </Button>
        </Link>
      </div>
    );
  }

  const patient = matchEntry?.patient ?? null;
  const patientName = patient?.name ?? `Patient #${session.id}`;
  const initials = patientName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  const brief = (session as any).clinicalBrief ?? null;
  const phq9 = matchEntry?.session?.phq9 ?? null;
  const gad7 = matchEntry?.session?.gad7 ?? null;

  const hrReadings = biometrics.filter((b) => b.metric === "heart_rate");
  const avgHR =
    hrReadings.length > 0
      ? Math.round(hrReadings.reduce((s, r) => s + r.value, 0) / hrReadings.length)
      : null;

  const matchId = matchEntry?.match.id ?? null;
  const status = matchEntry?.match.status ?? null;

  async function updateMatch(body: any) {
    if (!matchId) return;
    const res = await fetch(`/api/therapist/matches/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (res.ok) {
      // Refresh match
      const refreshed = await fetch("/api/therapist/my-matches", { credentials: "include" }).then((r) => r.json());
      const list: Match[] = Array.isArray(refreshed?.matches) ? refreshed.matches : [];
      setMatchEntry(list.find((m) => m.session?.id === sessionId) ?? null);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-[#E8E1D7] px-6 py-5 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/therapist-portal"
            className="inline-flex items-center text-sm font-medium text-[#5C544F] hover:text-[#2D2626] transition-colors"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
          <div className="h-4 w-[1px] bg-[#E8E1D7]" />
          <span className="font-medium text-[#2D2626]">
            Session brief #{session.id}
          </span>
          {status && (
            <span
              className={`text-[11px] font-mono uppercase tracking-wider px-2 py-1 rounded-md capitalize ${
                status === "accepted"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : status === "declined"
                  ? "bg-red-50 text-red-700 border border-red-100"
                  : "bg-amber-50 text-amber-700 border border-amber-100"
              }`}
            >
              {status}
            </span>
          )}
        </div>
        {matchId && status === "pending" && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-[#E8E1D7]"
              onClick={() => updateMatch({ status: "declined" })}
            >
              Decline
            </Button>
            <Button
              size="sm"
              className="rounded-xl bg-[#9B7250] hover:bg-[#8B6B5D] text-white"
              onClick={() => updateMatch({ status: "accepted" })}
            >
              Accept patient
            </Button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        {/* Patient column */}
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-[#E8E1D7] shadow-sm p-6">
            <div className="flex flex-col items-center text-center mb-6">
              <Avatar className="h-20 w-20 border-2 border-white shadow-sm mb-3">
                <AvatarImage
                  src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                    patientName,
                  )}&backgroundColor=f0e6e6&textColor=2d2626`}
                />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <h2 className="font-medium text-lg text-[#2D2626]">{patientName}</h2>
              <p className="text-sm text-[#5C544F]">
                {brief?.clinicalProfile
                  ? String(brief.clinicalProfile).replace(/-/g, " ")
                  : "Intake brief"}
              </p>
            </div>

            {patient?.demographics && (
              <div className="grid grid-cols-2 gap-3 mb-2">
                {Object.entries(patient.demographics)
                  .filter(([, v]) => v != null && v !== "")
                  .slice(0, 4)
                  .map(([k, v]) => (
                    <div
                      key={k}
                      className="bg-[#FAFAF9] border border-[#E8E1D7] rounded-xl p-3 text-center"
                    >
                      <p className="text-[10px] uppercase tracking-wider text-[#5C544F] mb-1 font-medium">
                        {k}
                      </p>
                      <p className="text-sm font-medium text-[#2D2626]">{String(v)}</p>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* PHQ-9 / GAD-7 */}
          <ScreenerCard
            kind="phq9"
            data={phq9}
            matchId={matchId}
            onApprove={(v) => updateMatch({ phq9Approved: v })}
          />
          <ScreenerCard
            kind="gad7"
            data={gad7}
            matchId={matchId}
            onApprove={(v) => updateMatch({ gad7Approved: v })}
          />

          {avgHR != null && (
            <div className="bg-white rounded-2xl border border-[#E8E1D7] shadow-sm p-6">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#5C544F] mb-3">
                <Activity className="h-4 w-4 text-[#9B7250]" />
                Biometrics
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-3xl font-medium text-[#2D2626]">
                  {avgHR}
                </span>
                <span className="text-sm text-[#5C544F]">bpm avg</span>
              </div>
              <p className="text-xs text-[#5C544F] mt-1">
                {hrReadings.length} readings during intake
              </p>
            </div>
          )}
        </div>

        {/* Brief column */}
        <div className="bg-white rounded-2xl border border-[#E8E1D7] shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-[#E8E1D7] bg-[#FAFAF9] flex items-center justify-between">
            <h3 className="font-medium text-[#2D2626]">Clinical Brief (SOAP)</h3>
            <Link href={`/intake/${session.id}/brief`}>
              <Button variant="outline" size="sm" className="rounded-xl border-[#E8E1D7]">
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Full brief
              </Button>
            </Link>
          </div>

          <div className="flex-1 overflow-auto p-6 space-y-6">
            {brief?.clinicalProfile && (
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-[#5C544F] mb-2">
                  Primary clinical profile
                </p>
                <div className="bg-[#F5EFE6] text-[#9B7250] text-sm font-medium px-3 py-2 rounded-lg inline-block capitalize">
                  {String(brief.clinicalProfile).replace(/-/g, " ")}
                </div>
              </div>
            )}

            {brief ? (
              <div className="space-y-5">
                <SoapSection title="Subjective" body={brief.subjective} />
                <SoapSection title="Objective" body={formatObjective(brief.objective)} />
                <SoapSection title="Assessment" body={brief.assessment} />
                <SoapSection title="Plan" body={brief.plan} />
              </div>
            ) : (
              <div className="flex flex-col items-center text-center py-10">
                <AlertTriangle className="h-7 w-7 text-amber-500 mb-3" />
                <p className="text-sm text-[#5C544F]">
                  Brief not generated yet — the intake session may still be in progress.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatObjective(o: any): string | null {
  if (!o) return null;
  if (typeof o === "string") return o;
  const parts: string[] = [];
  if (o.readingCount) {
    parts.push(`Captured ${o.readingCount} biometric reading${o.readingCount === 1 ? "" : "s"} during the session.`);
  }
  if (o.averageHr != null) {
    parts.push(`Average heart rate ${Math.round(o.averageHr)} bpm${o.peakHr != null ? ` (peak ${Math.round(o.peakHr)} bpm)` : ""}.`);
  }
  if (o.averageHrv != null) {
    parts.push(`Average HRV ${Math.round(o.averageHrv)} ms.`);
  }
  const events = o.biometricSubtextEvents?.length ?? 0;
  if (events > 0) {
    parts.push(`${events} sympathetic activation moment${events === 1 ? "" : "s"} correlated to transcript content.`);
  }
  return parts.length > 0 ? parts.join(" ") : "No biometric telemetry was captured for this session.";
}

function SoapSection({ title, body }: { title: string; body?: string | null }) {
  if (!body) return null;
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-[#9B7250] mb-2">
        {title}
      </p>
      <div className="text-[14px] text-[#2D2626] leading-relaxed bg-[#FAFAF9] border border-[#E8E1D7] p-4 rounded-lg whitespace-pre-wrap">
        {body}
      </div>
    </div>
  );
}

function ScreenerCard({
  kind,
  data,
  matchId,
  onApprove,
}: {
  kind: "phq9" | "gad7";
  data: any;
  matchId: number | null;
  onApprove: (approved: boolean) => void;
}) {
  const label = kind === "phq9" ? "PHQ-9 (Depression)" : "GAD-7 (Anxiety)";
  if (!data || typeof data.score !== "number") {
    return (
      <div className="bg-white rounded-2xl border border-[#E8E1D7] shadow-sm p-6">
        <p className="text-xs font-mono uppercase tracking-wider text-[#5C544F] mb-2">
          {label}
        </p>
        <p className="text-sm text-[#5C544F]">Not available for this session.</p>
      </div>
    );
  }
  const sev = severity(data.score, kind);
  const max = kind === "phq9" ? 27 : 21;
  const approved = !!data.approvedAt;
  return (
    <div className="bg-white rounded-2xl border border-[#E8E1D7] shadow-sm p-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-mono uppercase tracking-wider text-[#5C544F]">{label}</p>
        <span
          className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded ${sev.color}`}
        >
          {sev.label}
        </span>
      </div>
      <div className="flex items-baseline gap-1 mb-3">
        <span className="font-serif text-3xl font-medium text-[#2D2626]">
          {data.score}
        </span>
        <span className="text-sm text-[#5C544F]">/ {max}</span>
      </div>
      {data.rationale && (
        <p className="text-xs text-[#5C544F] leading-relaxed mb-3">{data.rationale}</p>
      )}
      {matchId && (
        <Button
          size="sm"
          variant={approved ? "outline" : "default"}
          className={
            approved
              ? "w-full rounded-xl border-[#E8E1D7] text-[#2D2626]"
              : "w-full rounded-xl bg-[#9B7250] hover:bg-[#8B6B5D] text-white"
          }
          onClick={() => onApprove(!approved)}
        >
          {approved ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-[#9B7250]" />
              Approved — revoke
            </>
          ) : (
            "Approve score"
          )}
        </Button>
      )}
    </div>
  );
}
