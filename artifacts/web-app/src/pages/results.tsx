import { useParams, Link } from "wouter";
import { useGetSessionBrief, useMatchTherapist, getGetSessionBriefQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, CheckCircle2, ArrowRight, Star, Calendar, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect } from "react";

function SpecialtyBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/8 text-primary/80 border border-primary/15 font-mono uppercase tracking-wide">
      {label.replace(/-/g, " ")}
    </span>
  );
}

function MatchCard({
  therapist,
  matchReason,
  rank,
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
}) {
  const bestOutcome =
    Object.values(therapist.outcomeData).sort((a, b) => b.successRate - a.successRate)[0] ?? null;

  const initials = therapist.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <div className={`relative bg-card border rounded-xl overflow-hidden transition-shadow hover:shadow-md ${rank === 1 ? "border-primary/30 shadow-sm" : "border-border/50"}`}>
      {rank === 1 && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
      )}
      <div className="p-6 flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14 border-2 border-border/40 shrink-0">
            <AvatarFallback className="bg-primary/8 text-primary font-serif text-lg font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium text-foreground text-base leading-tight">{therapist.name}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{therapist.providerProfile.title}</p>
              </div>
              {rank === 1 && (
                <span className="shrink-0 text-[10px] font-mono uppercase tracking-[0.15em] text-primary bg-primary/8 px-2 py-0.5 rounded border border-primary/15">
                  Best match
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {therapist.providerProfile.location}
            </div>
          </div>
        </div>

        {matchReason && (
          <div className="bg-muted/50 border border-border/40 rounded-lg px-3.5 py-2.5">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/80 leading-relaxed font-medium">{matchReason}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {therapist.specialties.slice(0, 4).map((s) => (
            <SpecialtyBadge key={s} label={s} />
          ))}
          {therapist.specialties.length > 4 && (
            <span className="text-[10px] text-muted-foreground self-center">+{therapist.specialties.length - 4}</span>
          )}
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/60" />
          <span>{therapist.availability.summary}</span>
        </div>

        <div className="flex gap-2 pt-1 border-t border-border/40">
          <Link href={`/therapists/${therapist.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full rounded-md text-xs h-9">
              View profile
            </Button>
          </Link>
          <Link href={`/therapists/${therapist.id}?request=1`} className="flex-1">
            <Button size="sm" className="w-full rounded-md text-xs h-9 bg-primary text-primary-foreground">
              Request session
            </Button>
          </Link>
        </div>
      </div>
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
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your session results…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-2xl font-serif text-foreground mb-2">Session not found</h2>
        <p className="text-muted-foreground mb-6">We couldn't find that session.</p>
        <Link href="/patient-portal">
          <Button variant="outline" className="rounded-md">Back to dashboard</Button>
        </Link>
      </div>
    );
  }

  const brief = session.clinicalBrief;
  const matches = matchTherapist.data?.matches ?? [];
  const matchReasons = matchTherapist.data?.matchReasons;

  return (
    <div className="flex-1 bg-background">
      <div className="border-b border-border/50 bg-muted/20">
        <div className="container max-w-screen-xl mx-auto px-4 md:px-8 py-10 md:py-14">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Intake complete
                </p>
              </div>
              <h1 className="font-serif text-4xl md:text-5xl font-medium text-foreground leading-tight mb-4">
                Your matched providers
              </h1>
              <p className="text-base text-muted-foreground leading-relaxed max-w-xl">
                Based on your intake session, we've identified the three providers in our network with the strongest documented outcomes for your specific presentation.
              </p>
              {brief?.clinicalProfile && (
                <div className="mt-5 inline-flex items-center gap-2 bg-card border border-border/50 rounded-lg px-4 py-2">
                  <span className="text-xs text-muted-foreground">Primary profile:</span>
                  <span className="text-xs font-medium text-foreground capitalize">
                    {brief.clinicalProfile.replace(/-/g, " ")}
                  </span>
                </div>
              )}
            </div>
            <div className="hidden md:flex flex-col gap-3 min-w-[200px]">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 text-primary/60 shrink-0" />
                <span>Matched from 55+ providers</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="h-4 w-4 text-primary/60 shrink-0" />
                <span>Ranked by outcome data</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary/60 shrink-0" />
                <span>Verified clinical track records</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-screen-xl mx-auto px-4 md:px-8 py-10 md:py-14">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            {matchTherapist.isPending && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
                <p className="text-sm font-medium text-foreground mb-1">Finding your best matches…</p>
                <p className="text-xs text-muted-foreground">Analyzing outcome data across our provider network</p>
              </div>
            )}

            {!matchTherapist.isPending && matches.length === 0 && (
              <div className="border border-border/50 rounded-xl p-10 text-center">
                <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-medium text-foreground mb-2">No specific matches found</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
                  We couldn't find a strong profile match, but our full network is available to browse.
                </p>
                <Link href="/therapists">
                  <Button variant="outline" className="rounded-md">Browse all providers</Button>
                </Link>
              </div>
            )}

            {!matchTherapist.isPending && matches.length > 0 && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-serif text-xl font-medium text-foreground">
                    {matches.length} matched {matches.length === 1 ? "provider" : "providers"}
                  </h2>
                  <Link href="/therapists" className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                    View all providers →
                  </Link>
                </div>
                {matches.map((therapist, i) => (
                  <MatchCard
                    key={therapist.id}
                    therapist={therapist}
                    matchReason={matchReasons?.[String(therapist.id)]}
                    rank={i + 1}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-5">
            <div className="border border-border/50 rounded-xl p-5 bg-card">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">
                Your clinical brief
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                We generated a full SOAP clinical note from your session — ready for your provider before your first appointment.
              </p>
              <Link href={`/intake/${sessionId}/brief`}>
                <Button variant="outline" className="w-full rounded-md text-sm" size="sm">
                  View full brief <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </div>

            {brief && (
              <div className="border border-border/50 rounded-xl p-5 bg-card">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
                  What we found
                </p>
                <p className="text-sm text-foreground leading-relaxed line-clamp-4">
                  {brief.subjective}
                </p>
                {brief.clinicalProfile && (
                  <div className="mt-3 pt-3 border-t border-border/40">
                    <p className="text-xs text-muted-foreground">Primary concern</p>
                    <p className="text-sm font-medium text-foreground capitalize mt-0.5">
                      {brief.clinicalProfile.replace(/-/g, " ")}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="border border-border/50 rounded-xl p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
                Not what you expected?
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Browse our full directory of 55+ verified providers across all specialties.
              </p>
              <Link href="/therapists" className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline underline-offset-4">
                Browse directory <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
