import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useGetTherapist, getGetTherapistQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, MapPin, Calendar, Award, GraduationCap, ChevronLeft, CheckCircle2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function TherapistDetail() {
  const params = useParams();
  const therapistId = Number(params.therapistId);
  const [location] = useLocation();
  const [requested, setRequested] = useState(false);

  const { data: therapist, isLoading, error } = useGetTherapist(therapistId, {
    query: { queryKey: getGetTherapistQueryKey(therapistId), enabled: !!therapistId },
  });

  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    if (search.includes("request=1")) {
      setRequested(true);
    }
  }, [location]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
      </div>
    );
  }

  if (error || !therapist) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-2xl font-serif text-foreground mb-2">Therapist not found</h2>
        <p className="text-muted-foreground mb-6">We couldn't find the requested provider.</p>
        <Link href="/therapists">
          <Button variant="outline">Back to Directory</Button>
        </Link>
      </div>
    );
  }

  const outcomeEntries = Object.entries(therapist.outcomeData as Record<string, { successRate: number; caseCount: number }>);
  const totalCases = outcomeEntries.reduce((sum, [, d]) => sum + d.caseCount, 0);
  const overallSuccess =
    outcomeEntries.reduce((sum, [, d]) => sum + d.successRate * d.caseCount, 0) / Math.max(1, totalCases);

  const initials = therapist.name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="container max-w-5xl mx-auto py-12 px-4 md:px-8 space-y-8">
      {requested && (
        <div className="flex items-start gap-3 bg-primary/8 border border-primary/20 rounded-xl px-5 py-4">
          <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Session request sent to {therapist.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your intake brief and clinical summary have been shared. Expect a response within 24 hours.
            </p>
          </div>
        </div>
      )}

      <div>
        <Link href="/therapists" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Directory
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          <Card className="bg-card border-border/50 shadow-sm overflow-hidden text-center pt-8">
            <CardContent className="flex flex-col items-center p-6 pt-0">
              <Avatar className="h-32 w-32 border-4 border-background shadow-sm mb-4">
                <AvatarFallback className="bg-primary/5 text-primary text-3xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <h1 className="font-serif text-2xl font-medium text-foreground">{therapist.name}</h1>
              <p className="text-muted-foreground">{therapist.providerProfile.title}</p>

              <div className="flex items-center text-sm text-muted-foreground mt-2 mb-6">
                <MapPin className="h-4 w-4 mr-1" />
                {therapist.providerProfile.location}
              </div>

              {requested ? (
                <Button className="w-full rounded-md" size="default" variant="outline" disabled>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-primary" />
                  Request sent
                </Button>
              ) : (
                <Button
                  className="w-full rounded-md"
                  size="default"
                  onClick={() => setRequested(true)}
                >
                  Request session
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50 shadow-sm">
            <CardContent className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Availability</h3>
                <div className="bg-primary/5 rounded-xl p-4">
                  <div className="flex items-center text-sm font-medium text-primary mb-1">
                    <Calendar className="h-4 w-4 mr-2" />
                    {therapist.availability.summary}
                  </div>
                  {therapist.availability.nextOpenSlot && (
                    <p className="text-xs text-muted-foreground pl-6">
                      Next slot: {new Date(therapist.availability.nextOpenSlot).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Care Formats</h3>
                <div className="flex flex-wrap gap-2">
                  {(therapist.careFormats as string[]).map((f: string) => (
                    <Badge key={f} variant="outline" className="bg-background">{f}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Languages</h3>
                <p className="text-sm text-foreground">{(therapist.languages as string[]).join(", ")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-8">
          <div>
            <h2 className="font-serif text-2xl font-medium mb-4">About</h2>
            <div className="prose prose-sm md:prose-base max-w-none text-muted-foreground leading-relaxed">
              {therapist.providerProfile.bio.split("\n\n").map((paragraph: string, i: number) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <Card className="bg-card border-border/50 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <h3 className="font-medium text-lg">Specialties</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(therapist.specialties as string[]).map((s: string) => (
                    <Badge key={s} variant="secondary" className="bg-secondary/50 font-normal">{s}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center text-accent-foreground">
                    <Award className="h-5 w-5" />
                  </div>
                  <h3 className="font-medium text-lg">Modalities</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(therapist.modalities as string[]).map((m: string) => (
                    <Badge key={m} variant="secondary" className="bg-secondary/50 font-normal">{m}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <h2 className="font-serif text-2xl font-medium mb-4">Clinical Outcomes</h2>
            <Card className="bg-card border-border/50 shadow-sm">
              <CardContent className="p-6">
                <div className="mb-6 flex items-baseline gap-2">
                  <span className="text-4xl font-medium text-primary">{Math.round(overallSuccess)}%</span>
                  <span className="text-muted-foreground">overall improvement rate</span>
                </div>
                <div className="space-y-4">
                  {outcomeEntries.map(([condition, data]) => (
                    <div key={condition}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-foreground">{condition}</span>
                        <span className="text-muted-foreground">{Math.round(data.successRate)}% ({data.caseCount} cases)</span>
                      </div>
                      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-1000"
                          style={{ width: `${data.successRate}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
