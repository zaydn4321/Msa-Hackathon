import { useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useGetSessionBrief, useMatchTherapist, getGetSessionBriefQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, MapPin, UserRound, ArrowRight, HeartPulse, Activity } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function IntakeBrief() {
  const params = useParams();
  const sessionId = Number(params.sessionId);
  const [, setLocation] = useLocation();

  const { data: session, isLoading, error } = useGetSessionBrief(sessionId, {
    query: { queryKey: getGetSessionBriefQueryKey(sessionId), enabled: !!sessionId },
  });

  const matchTherapist = useMatchTherapist();

  useEffect(() => {
    if (session?.clinicalBrief?.clinicalProfile && !matchTherapist.data && !matchTherapist.isPending && !matchTherapist.isError) {
      matchTherapist.mutate({
        data: {
          clinicalProfile: session.clinicalBrief.clinicalProfile,
          sessionId: sessionId
        }
      });
    }
  }, [session, matchTherapist, sessionId]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Synthesizing your clinical brief...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-2xl font-serif text-foreground mb-2">Unable to load brief</h2>
        <p className="text-muted-foreground mb-6">There was an error retrieving your session details.</p>
        <Link href="/">
          <Button variant="outline">Return Home</Button>
        </Link>
      </div>
    );
  }

  const brief = session.clinicalBrief;

  if (!brief) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-2xl font-serif text-foreground mb-2">Brief in progress</h2>
        <p className="text-muted-foreground mb-6">Your clinical brief is currently being generated. Please check back in a few minutes.</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="rounded-md">Refresh</Button>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto py-12 px-4 md:px-8 space-y-12">
      <div className="space-y-3 pb-4 border-b border-border/50">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">Intake complete</p>
        <h1 className="font-serif text-4xl md:text-5xl font-medium tracking-tight text-foreground">Clinical Brief</h1>
        <p className="text-base text-muted-foreground max-w-2xl">
          A clinical summary of your session and matched providers based on your presentation.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <Card className="bg-card border-border/50 shadow-sm overflow-hidden">
            <div className="bg-secondary/30 border-b border-border/50 p-6">
              <h2 className="font-serif text-2xl font-medium">SOAP Note</h2>
              <p className="text-sm text-muted-foreground mt-1">Clinical synthesis of your session</p>
            </div>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <h3 className="font-medium text-primary uppercase tracking-wider text-xs">Subjective</h3>
                <p className="text-foreground leading-relaxed">{brief.subjective}</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium text-primary uppercase tracking-wider text-xs">Objective</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><HeartPulse className="w-3 h-3" /> Avg HR</p>
                    <p className="font-medium">{brief.objective.averageHr ? `${Math.round(brief.objective.averageHr)} bpm` : 'N/A'}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Activity className="w-3 h-3" /> Avg HRV</p>
                    <p className="font-medium">{brief.objective.averageHrv ? `${Math.round(brief.objective.averageHrv)} ms` : 'N/A'}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><HeartPulse className="w-3 h-3" /> Peak HR</p>
                    <p className="font-medium">{brief.objective.peakHr ? `${Math.round(brief.objective.peakHr)} bpm` : 'N/A'}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Readings</p>
                    <p className="font-medium">{brief.objective.readingCount}</p>
                  </div>
                </div>
                {brief.objective.biometricSubtextEvents && brief.objective.biometricSubtextEvents.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">Physiological Cues</p>
                    {brief.objective.biometricSubtextEvents.map((event, i) => (
                      <div key={i} className="text-sm border-l-2 border-primary/30 pl-3 py-1">
                        <p className="text-muted-foreground italic mb-1">"{event.text}"</p>
                        <p className="text-xs text-primary/80">HR spiked {Math.round(event.spikePercent)}% to {Math.round(event.hrValue)} bpm at {event.timestamp}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h3 className="font-medium text-primary uppercase tracking-wider text-xs">Assessment</h3>
                <p className="text-foreground leading-relaxed">{brief.assessment}</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium text-primary uppercase tracking-wider text-xs">Plan</h3>
                <p className="text-foreground leading-relaxed">{brief.plan}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl font-medium">Your Matches</h2>
          </div>
          
          {matchTherapist.isPending ? (
            <div className="py-12 flex flex-col items-center justify-center text-center bg-card rounded-2xl border border-border/50">
              <Loader2 className="h-6 w-6 text-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Finding the right therapists...</p>
            </div>
          ) : matchTherapist.isError ? (
            <div className="py-8 px-4 text-center bg-destructive/5 rounded-2xl border border-destructive/20 text-destructive-foreground">
              <p>Could not load matches.</p>
            </div>
          ) : matchTherapist.data?.matches && matchTherapist.data.matches.length > 0 ? (
            <div className="space-y-4">
              {matchTherapist.data.matches.slice(0, 3).map((therapist) => (
                <Card key={therapist.id} className="bg-card border-border/50 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => setLocation(`/therapists/${therapist.id}`)}>
                  <CardContent className="p-5 flex gap-4">
                    <Avatar className="h-14 w-14 border border-border/50">
                      <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${therapist.name}&backgroundColor=f0e6e6&textColor=2d2626`} />
                      <AvatarFallback>{therapist.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate">{therapist.name}</h3>
                      <p className="text-sm text-muted-foreground mb-2 truncate">{therapist.providerProfile.title}</p>
                      <div className="flex flex-wrap gap-1">
                        {therapist.specialties.slice(0, 2).map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal bg-secondary/50">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button asChild variant="outline" className="w-full mt-4 rounded-md">
                <Link href="/therapists">
                  View All Therapists <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="py-12 text-center bg-card rounded-2xl border border-border/50">
              <p className="text-muted-foreground">No perfect matches found. Please browse our directory.</p>
              <Button asChild variant="outline" className="mt-4 rounded-md">
                <Link href="/therapists">Browse Directory</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
