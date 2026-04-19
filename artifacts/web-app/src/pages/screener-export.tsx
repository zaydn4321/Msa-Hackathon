import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type ExportPayload = {
  response: {
    id: number;
    requestId: number;
    instrument: "phq9" | "gad7";
    score: {
      score: number;
      maxScore: number;
      severity: string;
      rationale?: string;
      items?: { prompt: string; score: number }[];
      approvedAt?: string | null;
    };
    submittedAt: string;
    approvedAt: string | null;
    confirmedCpt: string[] | null;
  };
  request: {
    id: number;
    note: string | null;
    createdAt: string;
    completedAt: string | null;
    cptSuggestions: string[];
  } | null;
  patient: { id: number; name: string; demographics: any } | null;
  therapist: { id: number; name: string };
  baseline: {
    score: number;
    maxScore: number;
    severity: string;
  } | null;
  instrumentLabel: string;
};

export default function ScreenerExport() {
  const params = useParams();
  const id = params.responseId;
  const [data, setData] = useState<ExportPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/therapist/screener-responses/${id}/export`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Failed");
        return r.json();
      })
      .then(setData)
      .catch((e) => setErr(String(e?.message ?? e)));
  }, [id]);

  if (err) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#F8F9FA] p-6">
        <p className="text-sm text-[#5C544F]">{err}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#F8F9FA]">
        <Loader2 className="h-6 w-6 animate-spin text-[#9B7250]" />
      </div>
    );
  }

  const cpt = data.response.confirmedCpt ?? data.request?.cptSuggestions ?? [];
  const delta = data.baseline ? data.response.score.score - data.baseline.score : null;

  return (
    <div className="min-h-[100dvh] bg-[#F8F9FA] py-6 px-4 print:bg-white print:p-0">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-[#E8E1D7] shadow-sm p-8 print:shadow-none print:border-0 print:rounded-none">
        <div className="flex items-center justify-between mb-6 print:mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-mono text-[#5C544F]">Screener Report</p>
            <h1 className="font-serif text-3xl text-[#2D2626] mt-1">{data.instrumentLabel} · {data.response.score.severity}</h1>
          </div>
          <Button onClick={() => window.print()} variant="outline" className="print:hidden rounded-xl border-[#E8E1D7]">
            <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-mono text-[#5C544F]">Patient</p>
            <p className="font-medium text-[#2D2626] mt-1">{data.patient?.name ?? "—"}</p>
            <p className="text-xs text-[#5C544F]">Patient ID: {10000 + (data.patient?.id ?? 0)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-mono text-[#5C544F]">Provider</p>
            <p className="font-medium text-[#2D2626] mt-1">{data.therapist.name}</p>
            <p className="text-xs text-[#5C544F]">
              Administered {new Date(data.response.submittedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[#FAFAF9] border border-[#E8E1D7] rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wider font-mono text-[#5C544F]">Current Score</p>
            <p className="font-serif text-3xl text-[#2D2626] mt-1">{data.response.score.score}<span className="text-sm text-[#A09890]">/{data.response.score.maxScore}</span></p>
            <p className="text-xs text-[#5C544F]">{data.response.score.severity}</p>
          </div>
          <div className="bg-[#FAFAF9] border border-[#E8E1D7] rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wider font-mono text-[#5C544F]">Baseline</p>
            {data.baseline ? (
              <>
                <p className="font-serif text-3xl text-[#2D2626] mt-1">{data.baseline.score}<span className="text-sm text-[#A09890]">/{data.baseline.maxScore}</span></p>
                <p className="text-xs text-[#5C544F]">{data.baseline.severity}</p>
              </>
            ) : (
              <p className="text-xs text-[#A09890] mt-3">No prior reading</p>
            )}
          </div>
          <div className="bg-[#FAFAF9] border border-[#E8E1D7] rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wider font-mono text-[#5C544F]">Δ Change</p>
            {delta !== null ? (
              <p
                className={`font-serif text-3xl mt-1 ${
                  delta > 0 ? "text-red-700" : delta < 0 ? "text-emerald-700" : "text-[#2D2626]"
                }`}
              >
                {delta > 0 ? "+" : ""}
                {delta}
              </p>
            ) : (
              <p className="text-xs text-[#A09890] mt-3">N/A</p>
            )}
            <p className="text-xs text-[#5C544F]">vs intake baseline</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-wider font-mono text-[#5C544F] mb-2">Item Responses</p>
          <table className="w-full text-sm border border-[#E8E1D7] rounded-lg overflow-hidden">
            <thead className="bg-[#FAFAF9] text-[#5C544F]">
              <tr>
                <th className="text-left p-2 text-xs font-medium">#</th>
                <th className="text-left p-2 text-xs font-medium">Item</th>
                <th className="text-right p-2 text-xs font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {(data.response.score.items ?? []).map((it, i) => (
                <tr key={i} className="border-t border-[#E8E1D7]">
                  <td className="p-2 text-[#A09890] text-xs">{i + 1}</td>
                  <td className="p-2 text-[#2D2626]">{it.prompt}</td>
                  <td className="p-2 text-right font-medium">{it.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.request?.note && (
          <div className="mb-6 bg-[#F5EFE6] border border-[#E8E1D7] rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wider font-mono text-[#5C544F] mb-1">Therapist Note</p>
            <p className="text-sm text-[#2D2626]">{data.request.note}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-mono text-[#5C544F] mb-2">CPT Codes</p>
            <ul className="text-sm text-[#2D2626] space-y-1">
              {cpt.length > 0 ? cpt.map((c) => <li key={c}>· {c}</li>) : <li className="text-[#A09890]">None</li>}
            </ul>
            <p className="text-[10px] text-[#A09890] mt-2 italic">Suggested for billing — clinician must confirm.</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-mono text-[#5C544F] mb-2">Approval</p>
            {data.response.approvedAt ? (
              <p className="text-sm text-emerald-700">
                Approved {new Date(data.response.approvedAt).toLocaleString("en-US")}
              </p>
            ) : (
              <p className="text-sm text-amber-700">Awaiting clinician approval</p>
            )}
          </div>
        </div>

        <p className="text-[10px] text-[#A09890] mt-8 leading-relaxed border-t border-[#E8E1D7] pt-4">
          This report was generated by Anamnesis from a patient self-report. {data.instrumentLabel} is a validated clinical screener and is intended as decision support only. Final diagnostic and billing decisions remain the responsibility of the licensed clinician.
        </p>
      </div>
    </div>
  );
}
