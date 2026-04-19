import { useParams, Link } from "wouter";
import { useGetSessionBrief, useMatchTherapist, getGetSessionBriefQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, CheckCircle2, ArrowRight, Star, Calendar, Users, Brain, AlertTriangle, ChevronDown, ChevronUp, Activity, ListChecks, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState } from "react";

type FeatureContribution = {
  feature: string;
  label: string;
  weight: number;
  rawValue: number;
  contribution: number;
  note?: string;
};

type FeatureBreakdownEntry = {
  score: number;
  features: FeatureContribution[];
  critiqueNote?: string | null;
  heuristicRank: number;
  finalRank: number;
};

type ClinicalProfileV2 = {
  primary: { slug: string; label: string; confidence: number };
  secondary: { slug: string; label: string; confidence: number }[];
  severity: "mild" | "moderate" | "severe";
  riskFlags: { suicidalIdeation: boolean; selfHarm: boolean; substanceUse: boolean; crisis: boolean };
  axisConfidence: { diagnosis: number; severity: number; risk: number };
  reasoning: string;
};

type AgentTrace = {
  pipelineVersion: string;
  generatedAt: string;
  degraded: boolean;
  degradedReason?: string;
  plan: string[];
  planRationale?: string;
  steps: Array<{
    stage: string;
    label: string;
    startedAt: string;
    durationMs: number;
    status: "ok" | "skipped" | "fallback" | "error";
    summary: string;
  }>;
  clinicalProfileV2?: ClinicalProfileV2 | null;
  candidatePoolSize: number;
  shortlistSize: number;
  finalMatchIds: number[];
};

function SpecialtyBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#F8F9FA] border border-[#E8E1D7] text-[#5C544F] font-mono uppercase tracking-wide">
      {label.replace(/-/g, " ")}
    </span>
  );
}

function StatusDot({ status }: { status: "ok" | "skipped" | "fallback" | "error" }) {
  const color = {
    ok: "bg-emerald-500",
    skipped: "bg-stone-300",
    fallback: "bg-amber-500",
    error: "bg-red-500",
  }[status];
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function severityClasses(severity: "mild" | "moderate" | "severe") {
  return {
    mild: "bg-emerald-50 border-emerald-200 text-emerald-700",
    moderate: "bg-amber-50 border-amber-200 text-amber-700",
    severe: "bg-red-50 border-red-200 text-red-700",
  }[severity];
}

function ClinicalProfileCard({ profile }: { profile: ClinicalProfileV2 }) {
  const risks = Object.entries(profile.riskFlags).filter(([, v]) => v).map(([k]) => k);
  return (
    <div className="border border-[#E8E1D7] rounded-2xl p-6 bg-white shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-3.5 w-3.5 text-[#9B7250]" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C544F]">Clinical profile</p>
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <h3 className="font-serif text-lg font-medium text-[#2D2626]">{profile.primary.label}</h3>
        <span className="text-xs text-[#A09890] font-mono">
          {Math.round(profile.primary.confidence * 100)}% conf
        </span>
      </div>
      <span className={`inline-block text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border ${severityClasses(profile.severity)}`}>
        {profile.severity}
      </span>
      {profile.secondary.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[#A09890] mb-1.5">Secondary</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.secondary.map((s) => (
              <span key={s.slug} className="text-xs px-2 py-0.5 rounded bg-[#FAFAF9] border border-[#E8E1D7] text-[#5C544F]">
                {s.label} <span className="text-[#A09890]">{Math.round(s.confidence * 100)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {risks.length > 0 && (
        <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-800">Clinical attention</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {risks.map((r) => r.replace(/([A-Z])/g, " $1").toLowerCase()).join(", ")}
            </p>
          </div>
        </div>
      )}
      {profile.reasoning && (
        <p className="mt-4 text-xs text-[#5C544F] leading-relaxed italic">
          “{profile.reasoning}”
        </p>
      )}
      <div className="mt-4 pt-4 border-t border-[#E8E1D7] grid grid-cols-3 gap-2 text-center">
        {(["diagnosis", "severity", "risk"] as const).map((k) => (
          <div key={k}>
            <p className="text-[10px] font-mono uppercase tracking-widest text-[#A09890]">{k}</p>
            <p className="text-sm font-medium text-[#2D2626] mt-0.5">{Math.round(profile.axisConfidence[k] * 100)}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReasoningTimeline({ trace }: { trace: AgentTrace }) {
  const [expanded, setExpanded] = useState(false);
  const total = trace.steps.reduce((s, x) => s + x.durationMs, 0);
  return (
    <div className="border border-[#E8E1D7] rounded-2xl bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 p-5 hover:bg-[#FAFAF9] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-[#F5EFE6] border border-[#E8E1D7] flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-[#9B7250]" />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C544F]">
              Agent reasoning · {trace.pipelineVersion}
            </p>
            <p className="text-sm text-[#2D2626] mt-0.5">
              {trace.steps.length} stages · {(total / 1000).toFixed(1)}s · evaluated {trace.candidatePoolSize} providers, shortlisted {trace.shortlistSize}
              {trace.degraded && <span className="ml-2 text-amber-600">· degraded</span>}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-[#5C544F]" /> : <ChevronDown className="h-4 w-4 text-[#5C544F]" />}
      </button>
      {expanded && (
        <div className="border-t border-[#E8E1D7] p-5">
          {trace.planRationale && (
            <div className="mb-4 text-xs text-[#5C544F] italic leading-relaxed">
              <span className="font-mono uppercase tracking-widest text-[10px] text-[#A09890] not-italic mr-2">Plan</span>
              {trace.planRationale}
            </div>
          )}
          <ol className="space-y-3">
            {trace.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <StatusDot status={step.status} />
                  {i < trace.steps.length - 1 && <div className="flex-1 w-px bg-[#E8E1D7] my-1" />}
                </div>
                <div className="flex-1 pb-2">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="text-sm font-medium text-[#2D2626]">{step.label}</p>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#A09890]">
                      {step.status} · {step.durationMs}ms
                    </span>
                  </div>
                  <p className="text-xs text-[#5C544F] leading-relaxed mt-0.5">{step.summary}</p>
                </div>
              </li>
            ))}
          </ol>
          {trace.degraded && trace.degradedReason && (
            <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <strong>Degraded mode:</strong> {trace.degradedReason}. Some matches use heuristic fallbacks.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeatureBar({ contribution, label, note, rawValue }: { contribution: number; label: string; note?: string; rawValue: number }) {
  const pct = Math.max(0, Math.min(100, Math.abs(contribution) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-[#2D2626]">{label}</span>
        <span className="text-[10px] font-mono text-[#5C544F]">+{contribution.toFixed(2)}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-[#F5EFE6] overflow-hidden">
        <div className="h-full bg-[#9B7250]" style={{ width: `${pct}%` }} />
      </div>
      {note && <p className="text-[10px] text-[#A09890] mt-1 leading-relaxed">{note} · raw {rawValue}</p>}
    </div>
  );
}

function HowWeMatchedPanel({ breakdown }: { breakdown: FeatureBreakdownEntry }) {
  const [open, setOpen] = useState(false);
  const sorted = [...breakdown.features].sort((a, b) => b.contribution - a.contribution);
  return (
    <div className="border-t border-[#E8E1D7]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-6 py-3 flex items-center justify-between text-left hover:bg-[#FAFAF9] transition-colors"
      >
        <div className="flex items-center gap-2">
          <ListChecks className="h-3.5 w-3.5 text-[#9B7250]" />
          <span className="text-xs font-medium text-[#2D2626]">How we matched you</span>
          <span className="text-[10px] font-mono text-[#A09890]">score {breakdown.score.toFixed(2)}</span>
          {breakdown.heuristicRank !== breakdown.finalRank && (
            <span className="text-[10px] font-mono text-amber-700">re-ranked #{breakdown.heuristicRank}→#{breakdown.finalRank}</span>
          )}
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-[#5C544F]" /> : <ChevronDown className="h-3.5 w-3.5 text-[#5C544F]" />}
      </button>
      {open && (
        <div className="px-6 pb-5 space-y-3">
          {breakdown.critiqueNote && (
            <div className="p-3 rounded-xl bg-[#F5EFE6] border border-[#E8E1D7] text-xs text-[#2D2626] leading-relaxed">
              <span className="font-mono uppercase tracking-widest text-[10px] text-[#9B7250] mr-2">Critique</span>
              {breakdown.critiqueNote}
            </div>
          )}
          {sorted.map((f) => (
            <FeatureBar key={f.feature} contribution={f.contribution} label={f.label} note={f.note} rawValue={f.rawValue} />
          ))}
        </div>
      )}
    </div>
  );
}

function MatchCard({
  therapist,
  matchReason,
  rank,
  breakdown,
}: {
  therapist: {
    id: number;
    name: string;
    specialties: string[];
    outcomeData: Record<string, { successRate: number; caseCount: number }>;
    providerProfile: { title: string; location: string; bio: string };
    availability: { summary: string; nextOpenSlot?: string | null };
    languages: string[];
    modalities: string[];
  };
  matchReason?: string;
  rank: number;
  breakdown?: FeatureBreakdownEntry;
}) {
  const initials = therapist.name.split(" ").map((n) => n[0]).join("").slice(0, 2);

  return (
    <div className={`relative bg-white border rounded-2xl overflow-hidden transition-shadow hover:shadow-md ${rank === 1 ? "border-[#9B7250]/30 shadow-sm" : "border-[#E8E1D7]"}`}>
      {rank === 1 && <div className="absolute top-0 left-0 right-0 h-1 bg-[#9B7250]" />}
      <div className="p-6 flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14 border border-[#E8E1D7] shrink-0">
            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${therapist.name}&backgroundColor=f0e6e6&textColor=2d2626`} />
            <AvatarFallback className="bg-[#F5EFE6] text-[#2D2626] font-serif text-lg font-medium">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium text-[#2D2626] text-base leading-tight">{therapist.name}</h3>
                <p className="text-sm text-[#5C544F] mt-0.5">{therapist.providerProfile.title}</p>
              </div>
              {rank === 1 && (
                <span className="shrink-0 text-[10px] font-mono uppercase tracking-[0.15em] text-[#9B7250] bg-[#F5EFE6] px-2 py-0.5 rounded border border-[#E8E1D7]">
                  Best match
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-[#5C544F]">
              <MapPin className="h-3 w-3 shrink-0" />
              {therapist.providerProfile.location}
            </div>
          </div>
        </div>

        {matchReason && (
          <div className="bg-[#FAFAF9] border border-[#E8E1D7] rounded-xl px-4 py-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#9B7250] shrink-0 mt-0.5" />
              <p className="text-xs text-[#2D2626] leading-relaxed font-medium">{matchReason}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {therapist.specialties.slice(0, 4).map((s) => (
            <SpecialtyBadge key={s} label={s} />
          ))}
          {therapist.specialties.length > 4 && (
            <span className="text-[10px] text-[#A09890] self-center">+{therapist.specialties.length - 4}</span>
          )}
        </div>

        <div className="flex items-start gap-2 text-xs text-[#5C544F]">
          <Calendar className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#9B7250]" />
          <span>{therapist.availability.summary}</span>
        </div>

        <div className="flex gap-2 pt-4 border-t border-[#E8E1D7]">
          <Link href={`/therapists/${therapist.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full rounded-xl border-[#E8E1D7] text-xs h-10 font-medium text-[#2D2626]">
              View profile
            </Button>
          </Link>
          <Link href={`/therapists/${therapist.id}?request=1`} className="flex-1">
            <Button size="sm" className="w-full rounded-xl text-xs h-10 bg-[#9B7250] hover:bg-[#8B6B5D] text-white font-medium">
              Request session
            </Button>
          </Link>
        </div>
      </div>
      {breakdown && <HowWeMatchedPanel breakdown={breakdown} />}
    </div>
  );
}

export default function Results() {
  const params = useParams();
  const sessionId = Number(params.sessionId);

  const { data: session, isLoading: sessionLoading } = useGetSessionBrief(sessionId, {
    query: { queryKey: getGetSessionBriefQueryKey(sessionId), enabled: !!sessionId },
  });

  const matchTherapist = useMatchTherapist();

  useEffect(() => {
    if (
      session?.clinicalBrief?.clinicalProfile &&
      !matchTherapist.data &&
      !matchTherapist.isPending &&
      !matchTherapist.isError
    ) {
      matchTherapist.mutate({
        data: {
          clinicalProfile: session.clinicalBrief.clinicalProfile,
          sessionId,
        },
      });
    }
  }, [session, matchTherapist, sessionId]);

  if (sessionLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-4 bg-[#F8F9FA]">
        <Loader2 className="h-7 w-7 animate-spin text-[#9B7250]" />
        <p className="text-sm text-[#5C544F]">Loading your session results…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#F8F9FA] min-h-[100dvh]">
        <h2 className="text-2xl font-serif text-[#2D2626] mb-2">Session not found</h2>
        <p className="text-[#5C544F] mb-6">We couldn't find that session.</p>
        <Link href="/patient-portal">
          <Button variant="outline" className="rounded-xl border-[#E8E1D7]">Back to dashboard</Button>
        </Link>
      </div>
    );
  }

  const brief = session.clinicalBrief;
  const matches = matchTherapist.data?.matches ?? [];
  const matchReasons = (matchTherapist.data?.matchExplanations ?? matchTherapist.data?.matchReasons) as Record<string, string> | undefined;
  const featureBreakdown = matchTherapist.data?.featureBreakdown as Record<string, FeatureBreakdownEntry> | undefined;
  const profileV2 = (matchTherapist.data?.clinicalProfileV2 ?? session.agentTrace?.clinicalProfileV2) as ClinicalProfileV2 | undefined;
  const trace = (matchTherapist.data?.agentTrace ?? session.agentTrace) as AgentTrace | undefined;

  return (
    <div className="flex-1 bg-[#F8F9FA] min-h-[100dvh]">
      <div className="border-b border-[#E8E1D7] bg-white">
        <div className="container max-w-screen-xl mx-auto px-4 md:px-8 py-10 md:py-14">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-8 w-8 rounded-full bg-[#F5EFE6] border border-[#E8E1D7] flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-[#9B7250]" />
                </div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C544F]">
                  Intake complete
                </p>
              </div>
              <h1 className="font-serif text-4xl md:text-5xl font-medium text-[#2D2626] leading-tight mb-4">
                Your matched providers
              </h1>
              <p className="text-base text-[#5C544F] leading-relaxed max-w-xl">
                Our agentic matching pipeline reasoned over your transcript, biometrics, and screener scores to identify the providers in our network with the strongest fit and documented outcomes for your specific presentation.
              </p>
            </div>
            <div className="hidden md:flex flex-col gap-3 min-w-[200px]">
              <div className="flex items-center gap-2 text-sm text-[#5C544F]">
                <Users className="h-4 w-4 text-[#A09890] shrink-0" />
                <span>Matched from {trace?.candidatePoolSize ?? "55+"} providers</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#5C544F]">
                <Activity className="h-4 w-4 text-[#A09890] shrink-0" />
                <span>{trace?.steps.length ?? 6}-stage agent pipeline</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#5C544F]">
                <Star className="h-4 w-4 text-[#A09890] shrink-0" />
                <span>Bayesian-shrunk outcome scores</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-screen-xl mx-auto px-4 md:px-8 py-10 md:py-14">
        {trace && (
          <div className="mb-8">
            <ReasoningTimeline trace={trace} />
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            {matchTherapist.isPending && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Loader2 className="h-8 w-8 text-[#9B7250] animate-spin mb-4" />
                <p className="text-sm font-medium text-[#2D2626] mb-1">Finding your best matches…</p>
                <p className="text-xs text-[#5C544F]">Analyzing outcome data across our provider network</p>
              </div>
            )}

            {!matchTherapist.isPending && matches.length === 0 && (
              <div className="border border-[#E8E1D7] rounded-2xl p-10 text-center bg-white shadow-sm">
                <Users className="h-10 w-10 text-[#A09890] mx-auto mb-4" />
                <h3 className="font-medium text-[#2D2626] mb-2">No specific matches found</h3>
                <p className="text-sm text-[#5C544F] max-w-sm mx-auto mb-5">
                  We couldn't find a strong profile match, but our full network is available to browse.
                </p>
                <Link href="/therapists">
                  <Button variant="outline" className="rounded-xl border-[#E8E1D7]">Browse all providers</Button>
                </Link>
              </div>
            )}

            {!matchTherapist.isPending && matches.length > 0 && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-serif text-xl font-medium text-[#2D2626]">
                    {matches.length} matched {matches.length === 1 ? "provider" : "providers"}
                  </h2>
                  <Link href="/therapists" className="text-[10px] font-mono uppercase tracking-widest text-[#9B7250] hover:text-[#8B6B5D] transition-colors">
                    View all providers →
                  </Link>
                </div>
                {matches.map((therapist, i) => (
                  <MatchCard
                    key={therapist.id}
                    therapist={therapist}
                    matchReason={matchReasons?.[String(therapist.id)]}
                    rank={i + 1}
                    breakdown={featureBreakdown?.[String(therapist.id)]}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-5">
            {profileV2 ? (
              <ClinicalProfileCard profile={profileV2} />
            ) : brief?.clinicalProfile && (
              <div className="border border-[#E8E1D7] rounded-2xl p-6 bg-white shadow-sm">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C544F] mb-3">Primary concern</p>
                <p className="text-sm font-medium text-[#2D2626] capitalize">
                  {brief.clinicalProfile.replace(/-/g, " ")}
                </p>
              </div>
            )}

            <div className="border border-[#E8E1D7] rounded-2xl p-6 bg-white shadow-sm">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C544F] mb-4">
                Your clinical brief
              </p>
              <p className="text-sm text-[#5C544F] leading-relaxed mb-4">
                We generated a full SOAP clinical note from your session — ready for your provider before your first appointment.
              </p>
              <Link href={`/intake/${sessionId}/brief`}>
                <Button variant="outline" className="w-full rounded-xl text-sm border-[#E8E1D7]" size="sm">
                  View full brief <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </div>

            <div className="border border-[#E8E1D7] rounded-2xl p-6 bg-[#FAFAF9]">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C544F] mb-3">
                Not what you expected?
              </p>
              <p className="text-sm text-[#5C544F] leading-relaxed mb-4">
                Browse our full directory of 55+ verified providers across all specialties.
              </p>
              <Link href="/therapists" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#9B7250] hover:underline underline-offset-4">
                Browse directory <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
