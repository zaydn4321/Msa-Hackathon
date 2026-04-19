import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Loader2, ClipboardCheck, Printer, Trash2, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ScreenerScore = {
  score: number;
  maxScore: number;
  severity: string;
  approvedAt?: string | null;
};

type Activity = {
  requests: {
    id: number;
    instrument: "phq9" | "gad7";
    status: string;
    note: string | null;
    magicToken: string;
    expiresAt: string;
    createdAt: string;
    completedAt: string | null;
    cptSuggestions: string[] | null;
  }[];
  responses: {
    id: number;
    requestId: number;
    instrument: "phq9" | "gad7";
    score: ScreenerScore;
    submittedAt: string;
    approvedAt: string | null;
    confirmedCpt: string[] | null;
  }[];
  baseline: {
    sessionId: number | null;
    startedAt: string | null;
    phq9: ScreenerScore | null;
    gad7: ScreenerScore | null;
  };
};

const LABEL: Record<string, string> = { phq9: "PHQ-9", gad7: "GAD-7" };

export function ScreenerActivityPanel({
  patientId,
  refreshKey,
}: {
  patientId: number;
  refreshKey?: number;
}) {
  const [data, setData] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    fetch(`/api/therapist/patients/${patientId}/screener-activity`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(load, [patientId, refreshKey]);

  const cancelRequest = async (id: number) => {
    setBusy(`cancel-${id}`);
    try {
      await fetch(`/api/therapist/screener-requests/${id}`, { method: "DELETE", credentials: "include" });
      load();
    } finally {
      setBusy(null);
    }
  };

  const approveResponse = async (id: number, approve: boolean) => {
    setBusy(`approve-${id}`);
    try {
      await fetch(`/api/therapist/screener-responses/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: approve }),
      });
      load();
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-[#9B7250]" />
      </div>
    );
  }
  if (!data) return null;

  const open = data.requests.filter((r) => r.status === "pending" || r.status === "in_progress");
  const responses = data.responses.slice(0, 4);

  if (open.length === 0 && responses.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-[#E8E1D7] space-y-3">
      <p className="text-[10px] uppercase tracking-wider font-mono text-[#5C544F]">Re-assessments</p>

      {open.map((r) => (
        <div key={r.id} className="bg-amber-50/40 border border-amber-200/60 rounded-lg p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-[#2D2626]">
              {LABEL[r.instrument]} · <span className="text-amber-700 capitalize">{r.status.replace("_", " ")}</span>
            </span>
            <button
              onClick={() => cancelRequest(r.id)}
              disabled={busy === `cancel-${r.id}`}
              className="text-[#5C544F] hover:text-red-600 p-1"
              title="Cancel request"
            >
              {busy === `cancel-${r.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </button>
          </div>
          <p className="text-[#5C544F] mt-0.5">
            Sent {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · expires{" "}
            {new Date(r.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        </div>
      ))}

      {responses.map((resp) => {
        const baseline = resp.instrument === "phq9" ? data.baseline.phq9 : data.baseline.gad7;
        const delta = baseline ? resp.score.score - baseline.score : null;
        const approved = !!resp.approvedAt;
        return (
          <div key={resp.id} className="bg-white border border-[#E8E1D7] rounded-lg p-3 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-[#2D2626]">
                {LABEL[resp.instrument]} · {resp.score.severity}
              </span>
              <span className="text-[#5C544F]">
                {new Date(resp.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="bg-[#FAFAF9] rounded p-2 text-center">
                <p className="text-[9px] text-[#A09890] uppercase">Now</p>
                <p className="font-serif text-base text-[#2D2626]">
                  {resp.score.score}<span className="text-[10px] text-[#A09890]">/{resp.score.maxScore}</span>
                </p>
              </div>
              <div className="bg-[#FAFAF9] rounded p-2 text-center">
                <p className="text-[9px] text-[#A09890] uppercase">Baseline</p>
                <p className="font-serif text-base text-[#2D2626]">
                  {baseline ? `${baseline.score}` : "—"}
                  {baseline && <span className="text-[10px] text-[#A09890]">/{baseline.maxScore}</span>}
                </p>
              </div>
              <div className="bg-[#FAFAF9] rounded p-2 text-center">
                <p className="text-[9px] text-[#A09890] uppercase">Δ</p>
                <p
                  className={`font-serif text-base ${
                    delta == null ? "text-[#A09890]" : delta > 0 ? "text-red-700" : delta < 0 ? "text-emerald-700" : "text-[#2D2626]"
                  }`}
                >
                  {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={approved ? "outline" : "default"}
                disabled={busy === `approve-${resp.id}`}
                onClick={() => approveResponse(resp.id, !approved)}
                className={`h-7 text-[11px] rounded-md flex-1 ${
                  approved
                    ? "border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50"
                    : "bg-[#2D2626] hover:bg-black text-white"
                }`}
              >
                {busy === `approve-${resp.id}` ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : approved ? (
                  <><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</>
                ) : (
                  <><ClipboardCheck className="h-3 w-3 mr-1" /> Approve</>
                )}
              </Button>
              <Link href={`/therapist-portal/screener-responses/${resp.id}/export`}>
                <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-md border-[#E8E1D7]">
                  <Printer className="h-3 w-3 mr-1" /> Export
                </Button>
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
