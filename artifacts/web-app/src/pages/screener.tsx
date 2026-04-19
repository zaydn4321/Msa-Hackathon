import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Option = { value: number; label: string };

type RequestPayload = {
  request: {
    id: number;
    instrument: "phq9" | "gad7";
    note: string | null;
    status: string;
    expiresAt: string;
    createdAt: string;
    completedAt: string | null;
    draftResponses: Record<string, number>;
    label: string;
    prompts: string[];
    options: Option[];
  };
  therapistName: string;
};

const apiBase = "/api";

export default function ScreenerByToken() {
  const params = useParams();
  const token = params.token ?? "";
  const [data, setData] = useState<RequestPayload | null>(null);
  const [error, setError] = useState<{ message: string; status?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<Record<number, number>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${apiBase}/screeners/by-token/${token}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw { ...j, _status: r.status };
        return j as RequestPayload;
      })
      .then((j) => {
        setData(j);
        const draft = j.request.draftResponses ?? {};
        const cleaned: Record<number, number> = {};
        Object.entries(draft).forEach(([k, v]) => {
          const idx = Number(k);
          if (Number.isInteger(idx)) cleaned[idx] = Number(v);
        });
        setResponses(cleaned);
        const firstUnanswered = j.request.prompts.findIndex((_, i) => typeof cleaned[i] !== "number");
        setCurrentIdx(firstUnanswered === -1 ? j.request.prompts.length - 1 : firstUnanswered);
        setLoading(false);
      })
      .catch((err) => {
        setError({ message: err?.error ?? "Failed to load screener", status: err?.status });
        setLoading(false);
      });
  }, [token]);

  // Debounced auto-save of partial responses.
  useEffect(() => {
    if (!data || completed) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      fetch(`${apiBase}/screeners/by-token/${token}/draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses }),
      }).catch(() => {});
    }, 600);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [responses, data, token, completed]);

  // Auto-scroll the chat to bottom on new message.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [currentIdx, completed]);

  const messages = useMemo(() => {
    if (!data) return [] as { who: "bot" | "you"; text: string }[];
    const out: { who: "bot" | "you"; text: string }[] = [];
    out.push({
      who: "bot",
      text: `Hi — ${data.therapistName} asked you to complete a quick ${data.request.label} check-in. Over the last 2 weeks, how often have you been bothered by the following?`,
    });
    if (data.request.note) {
      out.push({ who: "bot", text: `Note from your therapist: "${data.request.note}"` });
    }
    const prompts = data.request.prompts;
    const upTo = Math.min(currentIdx, prompts.length - 1);
    for (let i = 0; i <= upTo; i++) {
      out.push({ who: "bot", text: `${i + 1}. ${prompts[i]}` });
      const r = responses[i];
      if (typeof r === "number") {
        const opt = data.request.options.find((o) => o.value === r);
        out.push({ who: "you", text: opt?.label ?? String(r) });
      }
    }
    return out;
  }, [data, responses, currentIdx]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#F8F9FA]">
        <Loader2 className="h-6 w-6 animate-spin text-[#9B7250]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#F8F9FA] p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-[#E8E1D7] shadow-sm p-8 text-center">
          <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <h1 className="font-serif text-2xl text-[#2D2626] mb-2">
            {error?.status === "completed" ? "Already submitted" : error?.status === "expired" ? "Link expired" : "Unable to open screener"}
          </h1>
          <p className="text-sm text-[#5C544F]">{error?.message ?? "Please contact your therapist."}</p>
        </div>
      </div>
    );
  }

  const prompts = data.request.prompts;
  const options = data.request.options;
  const allAnswered = prompts.every((_, i) => typeof responses[i] === "number");

  if (completed) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#F8F9FA] p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-[#E8E1D7] shadow-sm p-8 text-center">
          <div className="h-12 w-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <h1 className="font-serif text-2xl text-[#2D2626] mb-2">Thank you</h1>
          <p className="text-sm text-[#5C544F]">
            Your responses were sent to {data.therapistName}. You can close this window.
          </p>
        </div>
      </div>
    );
  }

  const onAnswer = (idx: number, value: number) => {
    setResponses((prev) => ({ ...prev, [idx]: value }));
    if (idx === currentIdx && currentIdx < prompts.length - 1) {
      setCurrentIdx(currentIdx + 1);
    }
  };

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      const r = await fetch(`${apiBase}/screeners/by-token/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError({ message: j.error ?? "Submission failed" });
      } else {
        setCompleted(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const progress = Math.round(
    (prompts.filter((_, i) => typeof responses[i] === "number").length / prompts.length) * 100,
  );

  return (
    <div className="min-h-[100dvh] bg-[#F8F9FA] flex flex-col">
      <header className="bg-white border-b border-[#E8E1D7] px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shadow-sm">
              <span className="font-serif italic text-sm text-primary-foreground leading-none -mt-0.5">A</span>
            </div>
            <span className="font-serif text-lg font-medium text-[#2D2626]">Anamnesis</span>
          </div>
          <div className="text-xs text-[#5C544F] font-mono">
            {data.request.label} · {progress}%
          </div>
        </div>
        <div className="max-w-2xl mx-auto mt-3 h-1 bg-[#F5EFE6] rounded-full overflow-hidden">
          <div className="h-full bg-[#9B7250] transition-all" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-auto px-4 sm:px-6 py-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-3 pb-32">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.who === "you" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${
                  m.who === "you"
                    ? "bg-[#9B7250] text-white rounded-br-sm"
                    : "bg-white border border-[#E8E1D7] text-[#2D2626] rounded-bl-sm"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 bg-white border-t border-[#E8E1D7] px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto">
          {currentIdx < prompts.length ? (
            <div className="grid grid-cols-2 gap-2">
              {options.map((opt) => {
                const selected = responses[currentIdx] === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => onAnswer(currentIdx, opt.value)}
                    className={`text-left text-[13px] rounded-xl border px-4 py-3 font-medium transition-colors ${
                      selected
                        ? "border-[#9B7250] bg-[#F5EFE6] text-[#9B7250]"
                        : "border-[#E8E1D7] bg-white text-[#2D2626] hover:bg-[#FAFAF9]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="flex items-center justify-between mt-3">
            <button
              onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
              disabled={currentIdx === 0}
              className="text-xs text-[#5C544F] hover:text-[#2D2626] disabled:opacity-40"
            >
              ← Previous
            </button>
            {allAnswered ? (
              <Button
                onClick={onSubmit}
                disabled={submitting}
                className="rounded-xl bg-[#9B7250] hover:bg-[#8B6B5D] text-white h-10 px-6 text-sm font-medium"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit responses"}
              </Button>
            ) : (
              <span className="text-xs text-[#A09890]">
                {prompts.length - prompts.filter((_, i) => typeof responses[i] === "number").length} remaining
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
