import { useState } from "react";
import { Loader2, X, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type Created = {
  id: number;
  instrument: "phq9" | "gad7";
  status: string;
  magicToken: string;
  expiresAt: string;
  cptSuggestions: string[];
};

export function ScreenerRequestModal({
  patientId,
  patientName,
  onClose,
  onCreated,
}: {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [phq9, setPhq9] = useState(true);
  const [gad7, setGad7] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const submit = async () => {
    const instruments = [phq9 ? "phq9" : null, gad7 ? "gad7" : null].filter(Boolean);
    if (instruments.length === 0) {
      setError("Select at least one instrument");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/therapist/screener-requests", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, instruments, note: note.trim() || undefined }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "Failed to send request");
        if (j.existing) setError(j.error + ". Cancel the existing request first.");
        return;
      }
      setCreated(j.requests);
      onCreated();
    } finally {
      setBusy(false);
    }
  };

  const copy = (token: string) => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/screener/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-[#E8E1D7]">
        <div className="flex items-center justify-between p-5 border-b border-[#E8E1D7]">
          <h3 className="font-serif text-xl text-[#2D2626]">
            {created ? "Screener sent" : "Request re-assessment"}
          </h3>
          <button onClick={onClose} className="p-1 text-[#5C544F] hover:text-[#2D2626]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!created ? (
          <div className="p-5 space-y-5">
            <p className="text-sm text-[#5C544F]">
              Ask <span className="font-medium text-[#2D2626]">{patientName}</span> to complete a screener.
            </p>
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider font-mono text-[#5C544F]">Instruments</p>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={phq9} onChange={(e) => setPhq9(e.target.checked)} className="h-4 w-4 accent-[#9B7250]" />
                PHQ-9 (depression)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={gad7} onChange={(e) => setGad7(e.target.checked)} className="h-4 w-4 accent-[#9B7250]" />
                GAD-7 (anxiety)
              </label>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider font-mono text-[#5C544F]">Optional note to patient</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="e.g. Quick check-in before our next session."
                className="w-full text-sm border border-[#E8E1D7] rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#9B7250]/30"
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose} className="rounded-xl border-[#E8E1D7] text-[#5C544F]">
                Cancel
              </Button>
              <Button onClick={submit} disabled={busy} className="rounded-xl bg-[#9B7250] hover:bg-[#8B6B5D] text-white">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send request"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <p className="text-sm text-[#5C544F]">
              {patientName} now has an in-app notification. Share the link below if you'd also like to text or email it.
            </p>
            {created.map((r) => {
              const url = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/screener/${r.magicToken}`;
              return (
                <div key={r.id} className="bg-[#FAFAF9] border border-[#E8E1D7] rounded-xl p-3">
                  <p className="text-[11px] font-medium text-[#5C544F] mb-1">
                    {r.instrument === "phq9" ? "PHQ-9" : "GAD-7"} · expires{" "}
                    {new Date(r.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={url}
                      className="flex-1 text-xs bg-white border border-[#E8E1D7] rounded px-2 py-1.5 font-mono text-[#2D2626]"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copy(r.magicToken)}
                      className="rounded-lg border-[#E8E1D7] h-8"
                    >
                      {copied === r.magicToken ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  {r.cptSuggestions?.length > 0 && (
                    <p className="text-[10px] text-[#A09890] mt-2">
                      CPT suggestions: {r.cptSuggestions.join(", ")}
                    </p>
                  )}
                </div>
              );
            })}
            <div className="flex justify-end pt-1">
              <Button onClick={onClose} className="rounded-xl bg-[#2D2626] hover:bg-black text-white">
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
