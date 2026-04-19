import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useGetTherapist, getGetTherapistQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, MapPin, Calendar, Award, GraduationCap, ChevronLeft, CheckCircle2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
        <Loader2 className="h-8 w-8 text-[#9B7250] animate-spin mb-4" />
      </div>
    );
  }

  if (error || !therapist) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#F8F9FA] min-h-[100dvh]">
        <h2 className="text-2xl font-serif text-[#2D2626] mb-2">Therapist not found</h2>
        <p className="text-[#5C544F] mb-6">We couldn't find the requested provider.</p>
        <Link href="/therapists">
          <Button variant="outline" className="rounded-xl border-[#E8E1D7]">Back to Directory</Button>
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
    <div className="container max-w-5xl mx-auto py-12 px-4 md:px-8 space-y-8 bg-[#F8F9FA] min-h-[100dvh]">
      {requested && (
        <div className="flex items-start gap-3 bg-[#F5EFE6] border border-[#E8E1D7] rounded-xl px-5 py-4">
          <CheckCircle2 className="h-5 w-5 text-[#9B7250] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#2D2626]">Session request sent to {therapist.name}</p>
            <p className="text-xs text-[#5C544F] mt-0.5">
              Your intake brief and clinical summary have been shared. Expect a response within 24 hours.
            </p>
          </div>
        </div>
      )}

      <div>
        <Link href="/therapists" className="inline-flex items-center text-sm font-medium text-[#5C544F] hover:text-[#2D2626] transition-colors mb-6">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Directory
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          <Card className="bg-white border-[#E8E1D7] shadow-sm overflow-hidden text-center pt-8 rounded-2xl">
            <CardContent className="flex flex-col items-center p-6 pt-0">
              <Avatar className="h-32 w-32 border-4 border-white shadow-sm mb-4">
                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${therapist.name}&backgroundColor=f0e6e6&textColor=2d2626`} />
                <AvatarFallback className="bg-[#F5EFE6] text-[#2D2626] text-3xl font-serif">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <h1 className="font-serif text-2xl font-medium text-[#2D2626]">{therapist.name}</h1>
              <p className="text-[#5C544F]">{therapist.providerProfile.title}</p>

              <div className="flex items-center text-sm text-[#5C544F] mt-2 mb-6">
                <MapPin className="h-4 w-4 mr-1" />
                {therapist.providerProfile.location}
              </div>

              {requested ? (
                <Button className="w-full rounded-xl bg-white border-[#E8E1D7] text-[#2D2626]" size="default" variant="outline" disabled>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-[#9B7250]" />
                  Request sent
                </Button>
              ) : (
                <Button
                  className="w-full rounded-xl bg-[#9B7250] hover:bg-[#8B6B5D] text-white"
                  size="default"
                  onClick={() => setRequested(true)}
                >
                  Request session
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white border-[#E8E1D7] shadow-sm rounded-2xl">
            <CardContent className="p-6 space-y-6">
              <div>
                <h3 className="text-[10px] font-mono font-medium text-[#5C544F] uppercase tracking-wider mb-3">Availability</h3>
                <div className="bg-[#F5EFE6] rounded-xl p-4">
                  <div className="flex items-center text-sm font-medium text-[#9B7250] mb-1">
                    <Calendar className="h-4 w-4 mr-2" />
                    {therapist.availability.summary}
                  </div>
                  {therapist.availability.nextOpenSlot && (
                    <p className="text-xs text-[#5C544F] pl-6">
                      Next slot: {new Date(therapist.availability.nextOpenSlot).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-mono font-medium text-[#5C544F] uppercase tracking-wider mb-3">Care Formats</h3>
                <div className="flex flex-wrap gap-2">
                  {(therapist.careFormats as string[]).map((f: string) => (
                    <span key={f} className="text-xs border border-[#E8E1D7] rounded-md px-2 py-1 text-[#5C544F]">{f}</span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-mono font-medium text-[#5C544F] uppercase tracking-wider mb-3">Languages</h3>
                <p className="text-sm text-[#2D2626]">{(therapist.languages as string[]).join(", ")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-8">
          <div>
            <h2 className="font-serif text-2xl font-medium text-[#2D2626] mb-4">About</h2>
            <div className="prose prose-sm md:prose-base max-w-none text-[#5C544F] leading-relaxed">
              {therapist.providerProfile.bio.split("\n\n").map((paragraph: string, i: number) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <Card className="bg-white border-[#E8E1D7] shadow-sm rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-[#F5EFE6] flex items-center justify-center text-[#9B7250]">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <h3 className="font-medium text-lg text-[#2D2626]">Specialties</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(therapist.specialties as string[]).map((s: string) => (
                    <span key={s} className="text-[11px] bg-[#F8F9FA] border border-[#E8E1D7] px-2 py-1 rounded text-[#5C544F]">{s}</span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-[#E8E1D7] shadow-sm rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-[#F8F9FA] flex items-center justify-center text-[#5C544F] border border-[#E8E1D7]">
                    <Award className="h-5 w-5" />
                  </div>
                  <h3 className="font-medium text-lg text-[#2D2626]">Modalities</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(therapist.modalities as string[]).map((m: string) => (
                    <span key={m} className="text-[11px] bg-[#F8F9FA] border border-[#E8E1D7] px-2 py-1 rounded text-[#5C544F]">{m}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <h2 className="font-serif text-2xl font-medium text-[#2D2626] mb-4">Clinical Outcomes</h2>
            <Card className="bg-white border-[#E8E1D7] shadow-sm rounded-2xl">
              <CardContent className="p-6">
                <div className="mb-6 flex items-baseline gap-2">
                  <span className="font-serif text-4xl font-medium text-[#9B7250]">{Math.round(overallSuccess)}%</span>
                  <span className="text-[#5C544F]">overall improvement rate</span>
                </div>
                <div className="space-y-4">
                  {outcomeEntries.map(([condition, data]) => (
                    <div key={condition}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-[#2D2626]">{condition}</span>
                        <span className="text-[#5C544F]">{Math.round(data.successRate)}% ({data.caseCount} cases)</span>
                      </div>
                      <div className="h-2 w-full bg-[#E8E1D7] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#9B7250] rounded-full transition-all duration-1000"
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
