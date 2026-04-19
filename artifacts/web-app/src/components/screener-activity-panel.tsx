import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Loader2,
  ClipboardCheck,
  Printer,
  Trash2,
  CheckCircle2,
  Pencil,
  History,
  Send,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Instrument = "phq9" | "gad7";

type EditEntry = {
  editedAt: string;
  editedBy: number;
  itemIndex: number | null;
  field: "score" | "rationale";
  fromValue: number | string | null;
  toValue: number | string | null;
};

type ScreenerItem = { prompt: string; score: number; evidence?: string };

type ScreenerScore = {
  score: number;
  maxScore: number;
  severity: string;
  approvedAt?: string | null;
  approvedBy?: number | null;
  approvalNote?: string | null;
  rationale?: string;
  items?: ScreenerItem[];
  editHistory?: EditEntry[];
};

type CadenceEntry = {
  instrument: Instrument;
  lastApprovedAt: string | null;
  daysSince: number | null;
  due: boolean;
  hasOpenRequest: boolean;
};

type Activity = {
  requests: {
    id: number;
    instrument: Instrument;
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
    instrument: Instrument;
    score: ScreenerScore;
    submittedAt: string;
    approvedAt: string | null;
    approvalNote: string | null;
    confirmedCpt: string[] | null;
  }[];
  baseline: {
    sessionId: number | null;
    startedAt: string | null;
    phq9: ScreenerScore | null;
    gad7: ScreenerScore | null;
  };
  cadence: {
    intervalDays: number;
    phq9: CadenceEntry;
    gad7: CadenceEntry;
  };
};

const LABEL: Record<Instrument, string> = { phq9: "PHQ-9", gad7: "GAD-7" };
const SCORE_OPTIONS = [0, 1, 2, 3];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ScreenerActivityPanel({
  patientId,
  patientName,
  refreshKey,
  onChanged,
  currentTherapistId,
}: {
  patientId: number;
  patientName?: string;
  refreshKey?: number;
  onChanged?: () => void;
  currentTherapistId?: number | null;
}) {
  const [data, setData] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Instrument | null>(null);
  const [draftItems, setDraftItems] = useState<number[]>([]);
  const [draftRationale, setDraftRationale] = useState("");
  const [approvalNoteFor, setApprovalNoteFor] = useState<number | null>(null);
  const [approvalNote, setApprovalNote] = useState("");
  const { toast } = useToast();

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
      await fetch(`/api/therapist/screener-requests/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      load();
      onChanged?.();
    } finally {
      setBusy(null);
    }
  };

  const sendRescreen = async (instrument: Instrument) => {
    setBusy(`send-${instrument}`);
    try {
      const res = await fetch(`/api/therapist/screener-requests`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, instruments: [instrument] }),
      });
      if (res.ok) {
        toast({ title: `${LABEL[instrument]} re-screen sent` });
        load();
        onChanged?.();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Could not send re-screen",
          description: err.error ?? "Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setBusy(null);
    }
  };

  const approveResponse = async (id: number, approve: boolean, note?: string) => {
    setBusy(`approve-${id}`);
    try {
      await fetch(`/api/therapist/screener-responses/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: approve, note: note ?? "" }),
      });
      setApprovalNoteFor(null);
      setApprovalNote("");
      load();
      onChanged?.();
    } finally {
      setBusy(null);
    }
  };

  const startEdit = (instrument: Instrument) => {
    if (!data) return;
    const baseline = instrument === "phq9" ? data.baseline.phq9 : data.baseline.gad7;
    if (!baseline?.items) return;
    setEditing(instrument);
    setDraftItems(baseline.items.map((it) => it.score));
    setDraftRationale(baseline.rationale ?? "");
  };

  const saveEdit = async () => {
    if (!editing || !data?.baseline.sessionId) return;
    const baseline = editing === "phq9" ? data.baseline.phq9 : data.baseline.gad7;
    if (!baseline?.items) return;
    setBusy(`edit-${editing}`);
    try {
      const items = draftItems
        .map((score, index) => ({ index, score }))
        .filter((it, i) => it.score !== baseline.items![i].score);
      const body: { items: { index: number; score: number }[]; rationale?: string } = {
        items,
      };
      if (draftRationale !== (baseline.rationale ?? "")) body.rationale = draftRationale;
      const res = await fetch(
        `/api/therapist/sessions/${data.baseline.sessionId}/screeners/${editing}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (res.ok) {
        toast({
          title: `${LABEL[editing]} updated`,
          description: "Approval cleared — please re-confirm.",
        });
        setEditing(null);
        load();
        onChanged?.();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Edit failed",
          description: err.error ?? "Please try again.",
          variant: "destructive",
        });
      }
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
  const cadence = data.cadence;

  const renderCadenceRow = (entry: CadenceEntry) => {
    const days = entry.daysSince;
    const lastLabel =
      days == null
        ? "Never screened"
        : days === 0
          ? "Screened today"
          : `Last screened ${days} day${days === 1 ? "" : "s"} ago`;
    return (
      <div
        key={entry.instrument}
        className="flex items-center justify-between bg-[#FAFAF9] border border-[#E8E1D7] rounded-lg px-3 py-2 text-xs"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="h-3.5 w-3.5 text-[#9B7250] shrink-0" />
          <span className="font-medium text-[#2D2626]">{LABEL[entry.instrument]}</span>
          <span className="text-[#5C544F] truncate">· {lastLabel}</span>
          {entry.due && (
            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              Due
            </span>
          )}
          {entry.hasOpenRequest && (
            <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
              Sent
            </span>
          )}
        </div>
        {entry.due && !entry.hasOpenRequest && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy === `send-${entry.instrument}`}
            onClick={() => sendRescreen(entry.instrument)}
            className="h-6 text-[10px] rounded-md border-[#E8E1D7] px-2"
          >
            {busy === `send-${entry.instrument}` ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Send className="h-3 w-3 mr-1" /> Send
              </>
            )}
          </Button>
        )}
      </div>
    );
  };

  const editedIndexes = (instrument: Instrument): Set<number> => {
    const baseline = instrument === "phq9" ? data?.baseline.phq9 : data?.baseline.gad7;
    const set = new Set<number>();
    for (const e of baseline?.editHistory ?? []) {
      if (e.field !== "score" || typeof e.itemIndex !== "number") continue;
      if (currentTherapistId != null && e.editedBy !== currentTherapistId) continue;
      set.add(e.itemIndex);
    }
    return set;
  };

  const myEditCount = (instrument: Instrument): number => {
    const baseline = instrument === "phq9" ? data?.baseline.phq9 : data?.baseline.gad7;
    if (!baseline?.editHistory) return 0;
    if (currentTherapistId == null) return baseline.editHistory.length;
    return baseline.editHistory.filter((e) => e.editedBy === currentTherapistId).length;
  };

  const renderBaselineEditor = (instrument: Instrument) => {
    const baseline = instrument === "phq9" ? data.baseline.phq9 : data.baseline.gad7;
    if (!baseline?.items) return null;
    const liveTotal = draftItems.reduce((s, n) => s + n, 0);
    const edited = editedIndexes(instrument);
    return (
      <div className="bg-white border border-[#9B7250]/40 rounded-lg p-3 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-medium text-[#2D2626]">
            Editing {LABEL[instrument]} · running total {liveTotal}/{baseline.maxScore}
          </span>
          <span className="text-[10px] text-amber-700">Saving will clear approval</span>
        </div>
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {baseline.items.map((it, i) => {
            const isEdited = edited.has(i);
            return (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[10px] text-[#A09890] font-mono mt-1 w-4 shrink-0">
                  {i + 1}.
                </span>
                <span className="flex-1 text-[11px] text-[#2D2626] leading-snug">
                  {it.prompt}
                  {isEdited && (
                    <span
                      className="ml-1 inline-flex items-center rounded-sm bg-amber-100 text-amber-800 border border-amber-200 px-1 text-[9px] font-semibold uppercase tracking-wide align-middle"
                      title="You previously edited this item"
                    >
                      edited
                    </span>
                  )}
                </span>
                <select
                  value={draftItems[i] ?? 0}
                  onChange={(e) => {
                    const next = [...draftItems];
                    next[i] = Number(e.target.value);
                    setDraftItems(next);
                  }}
                  className="h-7 rounded border border-[#E8E1D7] text-[11px] px-1 bg-white"
                >
                  {SCORE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
        <Textarea
          value={draftRationale}
          onChange={(e) => setDraftRationale(e.target.value)}
          placeholder="Clinical rationale (optional)"
          className="text-[11px] min-h-[48px] border-[#E8E1D7]"
        />
        <div className="flex items-center gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(null)}
            className="h-7 text-[11px] rounded-md border-[#E8E1D7]"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={saveEdit}
            disabled={busy === `edit-${instrument}`}
            className="h-7 text-[11px] rounded-md bg-[#2D2626] hover:bg-black text-white"
          >
            {busy === `edit-${instrument}` ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Save & re-confirm"
            )}
          </Button>
        </div>
      </div>
    );
  };

  const renderBaselineSummary = (instrument: Instrument) => {
    const baseline = instrument === "phq9" ? data.baseline.phq9 : data.baseline.gad7;
    if (!baseline) return null;
    const approved = !!baseline.approvedAt;
    const editCount = myEditCount(instrument);
    const itemsEdited = editedIndexes(instrument);
    const editLabel = currentTherapistId != null ? "by you" : "";
    return (
      <div
        key={`baseline-${instrument}`}
        className={`border rounded-lg p-3 text-xs ${
          approved ? "border-emerald-200 bg-emerald-50/30" : "border-[#E8E1D7] bg-white"
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-[#2D2626]">
            {LABEL[instrument]} baseline ·{" "}
            <span className="text-[#5C544F]">
              {baseline.score}/{baseline.maxScore} · {baseline.severity}
            </span>
          </span>
          <button
            onClick={() => (editing === instrument ? setEditing(null) : startEdit(instrument))}
            disabled={!data.baseline.sessionId || !baseline.items}
            className="text-[#5C544F] hover:text-[#9B7250] p-1 disabled:opacity-30"
            title="Edit items"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
        {baseline.approvalNote && (
          <p className="text-[11px] text-[#2D2626] italic mb-1">"{baseline.approvalNote}"</p>
        )}
        {editCount > 0 && (
          <p className="text-[10px] text-[#9B7250] flex items-center gap-1 mb-1 flex-wrap">
            <History className="h-3 w-3" />
            Edited {editCount} time{editCount === 1 ? "" : "s"} {editLabel}
            {itemsEdited.size > 0 && (
              <span className="text-[#9B7250]">
                · items{" "}
                {[...itemsEdited]
                  .sort((a, b) => a - b)
                  .map((i) => `Q${i + 1}`)
                  .join(", ")}
              </span>
            )}
            {baseline.editHistory && baseline.editHistory.length > 0 && (
              <span className="text-[#A09890]">
                · last {fmtDate(baseline.editHistory.at(-1)!.editedAt)}
              </span>
            )}
          </p>
        )}
        {!approved && baseline.items && (
          <p className="text-[10px] text-amber-700 font-medium uppercase tracking-wide">
            Needs re-approval
          </p>
        )}
        {editing === instrument && <div className="mt-2">{renderBaselineEditor(instrument)}</div>}
      </div>
    );
  };

  const showCadence = !!cadence;
  const hasBaseline = !!(data.baseline.phq9 || data.baseline.gad7);
  const hasContent = open.length > 0 || responses.length > 0 || hasBaseline || showCadence;
  if (!hasContent) return null;

  return (
    <div className="mt-4 pt-4 border-t border-[#E8E1D7] space-y-3">
      <p className="text-[10px] uppercase tracking-wider font-mono text-[#5C544F]">
        Screeners {patientName ? `· ${patientName}` : ""}
      </p>

      {showCadence && (
        <div className="space-y-1.5">
          {renderCadenceRow(cadence.phq9)}
          {renderCadenceRow(cadence.gad7)}
        </div>
      )}

      {hasBaseline && (
        <div className="space-y-2">
          {renderBaselineSummary("phq9")}
          {renderBaselineSummary("gad7")}
        </div>
      )}

      {open.map((r) => (
        <div
          key={r.id}
          className="bg-amber-50/40 border border-amber-200/60 rounded-lg p-3 text-xs"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-[#2D2626]">
              {LABEL[r.instrument]} ·{" "}
              <span className="text-amber-700 capitalize">{r.status.replace("_", " ")}</span>
            </span>
            <button
              onClick={() => cancelRequest(r.id)}
              disabled={busy === `cancel-${r.id}`}
              className="text-[#5C544F] hover:text-red-600 p-1"
              title="Cancel request"
            >
              {busy === `cancel-${r.id}` ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
            </button>
          </div>
          <p className="text-[#5C544F] mt-0.5">
            Sent {fmtDate(r.createdAt)} · expires {fmtDate(r.expiresAt)}
          </p>
        </div>
      ))}

      {responses.map((resp) => {
        const baseline =
          resp.instrument === "phq9" ? data.baseline.phq9 : data.baseline.gad7;
        const delta = baseline ? resp.score.score - baseline.score : null;
        const approved = !!resp.approvedAt;
        const showingNote = approvalNoteFor === resp.id;
        return (
          <div key={resp.id} className="bg-white border border-[#E8E1D7] rounded-lg p-3 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-[#2D2626]">
                {LABEL[resp.instrument]} · {resp.score.severity}
              </span>
              <span className="text-[#5C544F]">{fmtDate(resp.submittedAt)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="bg-[#FAFAF9] rounded p-2 text-center">
                <p className="text-[9px] text-[#A09890] uppercase">Now</p>
                <p className="font-serif text-base text-[#2D2626]">
                  {resp.score.score}
                  <span className="text-[10px] text-[#A09890]">/{resp.score.maxScore}</span>
                </p>
              </div>
              <div className="bg-[#FAFAF9] rounded p-2 text-center">
                <p className="text-[9px] text-[#A09890] uppercase">Baseline</p>
                <p className="font-serif text-base text-[#2D2626]">
                  {baseline ? `${baseline.score}` : "—"}
                  {baseline && (
                    <span className="text-[10px] text-[#A09890]">/{baseline.maxScore}</span>
                  )}
                </p>
              </div>
              <div className="bg-[#FAFAF9] rounded p-2 text-center">
                <p className="text-[9px] text-[#A09890] uppercase">Δ</p>
                <p
                  className={`font-serif text-base ${
                    delta == null
                      ? "text-[#A09890]"
                      : delta > 0
                        ? "text-red-700"
                        : delta < 0
                          ? "text-emerald-700"
                          : "text-[#2D2626]"
                  }`}
                >
                  {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta}`}
                </p>
              </div>
            </div>
            {resp.approvalNote && (
              <p className="text-[11px] text-[#2D2626] italic mb-2">"{resp.approvalNote}"</p>
            )}
            {showingNote && !approved && (
              <Textarea
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="Optional clinical note (e.g. 'Reviewed with patient on intake call')"
                className="text-[11px] min-h-[40px] border-[#E8E1D7] mb-2"
              />
            )}
            <div className="flex items-center gap-1.5">
              {!approved && !showingNote && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setApprovalNoteFor(resp.id);
                    setApprovalNote("");
                  }}
                  className="h-7 text-[11px] rounded-md text-[#5C544F]"
                >
                  + Add note
                </Button>
              )}
              <Button
                size="sm"
                variant={approved ? "outline" : "default"}
                disabled={busy === `approve-${resp.id}`}
                onClick={() =>
                  approveResponse(resp.id, !approved, showingNote ? approvalNote : undefined)
                }
                className={`h-7 text-[11px] rounded-md flex-1 ${
                  approved
                    ? "border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50"
                    : "bg-[#2D2626] hover:bg-black text-white"
                }`}
              >
                {busy === `approve-${resp.id}` ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : approved ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="h-3 w-3 mr-1" />
                    {showingNote ? "Approve with note" : "Approve"}
                  </>
                )}
              </Button>
              <Link href={`/therapist-portal/screener-responses/${resp.id}/export`}>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] rounded-md border-[#E8E1D7]"
                >
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
