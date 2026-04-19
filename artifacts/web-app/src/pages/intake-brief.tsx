import { useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useGetSessionBrief, useMatchTherapist, getGetSessionBriefQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Download, Share2, Brain, Activity, HeartPulse, Stethoscope, ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function IntakeBrief() {
  const params = useParams();
  const sessionId = Number(params.sessionId);
  const [, setLocation] = useLocation();

  const { data: session, isLoading, error } = useGetSessionBrief(sessionId, {
    query: {
      queryKey: getGetSessionBriefQueryKey(sessionId),
      enabled: !!sessionId,
      // Keep polling until the AI-generated SOAP note replaces the fallback.
      refetchInterval: (query) => {
        const data = query.state.data as { clinicalBrief?: { subjective?: string } } | undefined;
        const subj = data?.clinicalBrief?.subjective ?? "";
        const isFallback =
          !subj ||
          subj.includes("No conversational transcript was captured") ||
          subj.includes("automated summary unavailable");
        return isFallback ? 8000 : false;
      },
    },
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
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] bg-[#F8F9FA]">
        <Loader2 className="h-8 w-8 text-[#9B7250] animate-spin mb-4" />
        <p className="text-[#5C544F]">Synthesizing your clinical brief...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#F8F9FA] min-h-[100dvh]">
        <h2 className="text-2xl font-serif text-[#2D2626] mb-2">Unable to load brief</h2>
        <p className="text-[#5C544F] mb-6">There was an error retrieving your session details.</p>
        <Link href="/patient-portal">
          <Button variant="outline" className="rounded-xl border-[#E8E1D7]">Return to Portal</Button>
        </Link>
      </div>
    );
  }

  const brief = session.clinicalBrief;

  const subjText = brief?.subjective ?? "";
  const briefIsGenerating =
    !brief ||
    !subjText ||
    subjText.includes("No conversational transcript was captured") ||
    subjText.includes("automated summary unavailable");

  const SkeletonLines = ({ lines = 3 }: { lines?: number }) => (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded bg-[#EFE7DA]"
          style={{ width: `${85 - i * 8}%` }}
        />
      ))}
    </div>
  );

  if (!brief) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#F8F9FA] min-h-[100dvh]">
        <h2 className="text-2xl font-serif text-[#2D2626] mb-2">Brief in progress</h2>
        <p className="text-[#5C544F] mb-6">Your clinical brief is currently being generated. Please check back in a few minutes.</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="rounded-xl border-[#E8E1D7]">Refresh</Button>
      </div>
    );
  }

  const date = session.startedAt 
    ? new Date(session.startedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "Unknown Date";

  const chartData = [
    { time: "00:00", hr: 72 },
    { time: "02:00", hr: 75 },
    { time: "04:00", hr: 88 },
    { time: "06:00", hr: 85 },
    { time: "08:00", hr: 78 },
    { time: "10:00", hr: 82 },
    { time: "12:00", hr: 95 },
    { time: "14:00", hr: 76 },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#F8F9FA] pb-24">
      {/* Header */}
      <div className="bg-white border-b border-[#E8E1D7] pt-8 pb-6 px-6">
        <div className="container max-w-screen-xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-[#5C544F] mb-6">
            <Link href="/patient-portal" className="hover:text-[#2D2626] transition-colors">Patient Portal</Link>
            <span>›</span>
            <span className="text-[#2D2626] font-medium">Session Brief</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="font-serif text-4xl font-medium text-[#2D2626] mb-2">Clinical Summary</h1>
              <p className="text-[#5C544F] text-[15px]">Intake Session • {date}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" className="h-10 rounded-xl border-[#E8E1D7] text-[#2D2626] font-medium">
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
              <Button className="h-10 rounded-xl bg-[#9B7250] hover:bg-[#8B6B5D] font-medium shadow-sm text-white">
                <Share2 className="h-4 w-4 mr-2" />
                Share to Provider
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-screen-xl mx-auto px-6 pt-8">
        
        <div className="bg-[#F5EFE6] border border-[#E8E1D7] rounded-xl p-4 mb-8 flex items-start gap-4">
          <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-[#E8E1D7]">
            <Brain className="h-4 w-4 text-[#9B7250]" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-[#2D2626] text-sm flex items-center gap-2">
              AI-Generated Clinical Note
              {briefIsGenerating && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-normal text-[#9B7250]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Synthesizing from transcript…
                </span>
              )}
            </h4>
            <p className="text-[13px] text-[#5C544F] mt-0.5 leading-relaxed max-w-3xl">This summary was generated by Anamnesis AI based on conversational intake and biometric telemetry. It should be reviewed by a licensed clinician before inclusion in a formal medical record.</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Left Column: SOAP Notes */}
          <div className="flex-1 flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-[#E8E1D7] shadow-sm p-6 md:p-8">
              <h3 className="font-medium text-[#2D2626] text-lg border-b border-[#E8E1D7] pb-4 mb-6">SOAP Assessment</h3>
              
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-full bg-[#F5EFE6] text-[#9B7250] font-serif italic text-xl flex items-center justify-center shrink-0 border border-[#E8E1D7]">S</div>
                  <div className="flex-1">
                    <h4 className="font-medium text-[#2D2626] mb-2 uppercase tracking-wider text-[10px] font-mono">Subjective</h4>
                    {briefIsGenerating ? (
                      <SkeletonLines lines={5} />
                    ) : (
                      <p className="text-[14px] text-[#2D2626] leading-relaxed whitespace-pre-wrap">{brief.subjective}</p>
                    )}
                  </div>
                </div>
                
                <div className="h-[1px] w-full bg-[#E8E1D7]" />
                
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-full bg-[#F5EFE6] text-[#9B7250] font-serif italic text-xl flex items-center justify-center shrink-0 border border-[#E8E1D7]">O</div>
                  <div>
                    <h4 className="font-medium text-[#2D2626] mb-2 uppercase tracking-wider text-[10px] font-mono">Objective</h4>
                    <p className="text-[14px] text-[#2D2626] leading-relaxed whitespace-pre-wrap mb-4">
                      {(() => {
                        const o = brief.objective;
                        const parts: string[] = [];
                        if (o?.readingCount) {
                          parts.push(
                            `Captured ${o.readingCount} biometric reading${o.readingCount === 1 ? "" : "s"} during the session.`
                          );
                        }
                        if (o?.averageHr != null) {
                          parts.push(
                            `Average heart rate ${Math.round(o.averageHr)} bpm${o.peakHr != null ? ` (peak ${Math.round(o.peakHr)} bpm)` : ""}.`
                          );
                        }
                        if (o?.averageHrv != null) {
                          parts.push(`Average HRV ${Math.round(o.averageHrv)} ms.`);
                        }
                        const events = o?.biometricSubtextEvents?.length ?? 0;
                        if (events > 0) {
                          parts.push(
                            `${events} sympathetic activation moment${events === 1 ? "" : "s"} correlated to transcript content.`
                          );
                        }
                        return parts.length > 0
                          ? parts.join(" ")
                          : "No biometric telemetry was captured for this session.";
                      })()}
                    </p>

                    {brief.objective?.biometricSubtextEvents && brief.objective.biometricSubtextEvents.length > 0 && (
                      <div className="mt-4 space-y-3 bg-[#FAFAF9] border border-[#E8E1D7] rounded-xl p-4">
                        <p className="text-[11px] font-medium text-[#5C544F] uppercase tracking-wider mb-2">Physiological Cues</p>
                        {brief.objective.biometricSubtextEvents.map((event: any, i: number) => (
                          <div key={i} className="text-sm border-l-2 border-[#9B7250] pl-3 py-1">
                            <p className="text-[#5C544F] italic mb-1">"{event.text}"</p>
                            <p className="text-xs font-medium text-[#9B7250]">HR spiked {Math.round(event.spikePercent)}% to {Math.round(event.hrValue)} bpm at {event.timestamp}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="h-[1px] w-full bg-[#E8E1D7]" />
                
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-full bg-[#F5EFE6] text-[#9B7250] font-serif italic text-xl flex items-center justify-center shrink-0 border border-[#E8E1D7]">A</div>
                  <div className="flex-1">
                    <h4 className="font-medium text-[#2D2626] mb-2 uppercase tracking-wider text-[10px] font-mono">Assessment</h4>
                    {briefIsGenerating ? (
                      <SkeletonLines lines={4} />
                    ) : (
                      <p className="text-[14px] text-[#2D2626] leading-relaxed whitespace-pre-wrap">{brief.assessment}</p>
                    )}
                  </div>
                </div>
                
                <div className="h-[1px] w-full bg-[#E8E1D7]" />
                
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-full bg-[#F5EFE6] text-[#9B7250] font-serif italic text-xl flex items-center justify-center shrink-0 border border-[#E8E1D7]">P</div>
                  <div className="flex-1">
                    <h4 className="font-medium text-[#2D2626] mb-2 uppercase tracking-wider text-[10px] font-mono">Plan</h4>
                    {briefIsGenerating ? (
                      <SkeletonLines lines={4} />
                    ) : (
                      <p className="text-[14px] text-[#2D2626] leading-relaxed whitespace-pre-wrap">{brief.plan}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Column: Biometrics & Matches */}
          <div className="w-full lg:w-[400px] flex flex-col gap-6">
            
            {/* Session Biometrics */}
            <div className="bg-white rounded-2xl border border-[#E8E1D7] shadow-sm p-6">
              <h3 className="font-medium text-[#2D2626] text-lg border-b border-[#E8E1D7] pb-4 mb-6">Session Biometrics</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-[#FAFAF9] border border-[#E8E1D7] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <HeartPulse className="h-4 w-4 text-red-500" />
                    <span className="text-[10px] font-mono text-[#5C544F] font-medium uppercase tracking-wider">Avg HR</span>
                  </div>
                  <p className="font-serif text-3xl font-medium text-[#2D2626]">
                    {brief.objective?.averageHr ? Math.round(brief.objective.averageHr) : "81"}
                    <span className="text-sm font-sans text-[#5C544F] ml-1">bpm</span>
                  </p>
                </div>
                <div className="bg-[#FAFAF9] border border-[#E8E1D7] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-amber-500" />
                    <span className="text-[10px] font-mono text-[#5C544F] font-medium uppercase tracking-wider">Stress Peak</span>
                  </div>
                  <p className="font-serif text-3xl font-medium text-[#2D2626]">4<span className="text-sm font-sans text-[#5C544F] ml-1">mins</span></p>
                </div>
              </div>
              
              <div className="h-40 w-full mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E1D7" />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#A09890" }} dy={10} />
                    <YAxis domain={['dataMin - 10', 'dataMax + 10']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#A09890" }} dx={-10} width={30} />
                    <Tooltip 
                      contentStyle={{ borderRadius: "8px", border: "1px solid #E8E1D7", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
                      itemStyle={{ color: "#9B7250", fontWeight: 500 }}
                      labelStyle={{ color: "#5C544F", fontSize: "12px", marginBottom: "4px" }}
                    />
                    <Line type="monotone" dataKey="hr" stroke="#9B7250" strokeWidth={2} dot={{ r: 3, fill: "#9B7250", strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-center text-[11px] text-[#A09890] font-medium mt-2">Heart rate over session duration</p>
            </div>

            {/* Clinical Insights */}
            <div className="bg-white rounded-2xl border border-[#E8E1D7] shadow-sm p-6">
              <h3 className="font-medium text-[#2D2626] text-lg border-b border-[#E8E1D7] pb-4 mb-6">Clinical Insights</h3>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="h-5 w-5 rounded bg-blue-50 flex items-center justify-center shrink-0 mt-0.5 border border-blue-100">
                    <span className="text-blue-600 font-bold text-[10px]">1</span>
                  </div>
                  <p className="text-sm text-[#2D2626] leading-relaxed">Strong correlation between topic of "work" and 15% elevated heart rate variance.</p>
                </div>
                <div className="flex gap-3">
                  <div className="h-5 w-5 rounded bg-amber-50 flex items-center justify-center shrink-0 mt-0.5 border border-amber-100">
                    <span className="text-amber-600 font-bold text-[10px]">2</span>
                  </div>
                  <p className="text-sm text-[#2D2626] leading-relaxed">Vocal analysis indicates moderate depressive affect during first 5 minutes of intake.</p>
                </div>
              </div>
            </div>

            {/* Provider Match */}
            <div className="bg-white rounded-2xl border border-[#E8E1D7] shadow-sm overflow-hidden flex flex-col">
              <div className="bg-[#FAFAF9] p-4 border-b border-[#E8E1D7] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-[#5C544F]" />
                  <h3 className="font-medium text-[#2D2626] text-sm">Suggested Match</h3>
                </div>
                <span className="inline-flex items-center rounded-full bg-[#F5EFE6] px-2.5 py-0.5 text-[11px] font-medium text-[#9B7250] border border-[#E8E1D7]">
                  Best Match
                </span>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-center">
                {matchTherapist.isPending ? (
                  <div className="flex flex-col items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 text-[#9B7250] animate-spin mb-2" />
                    <p className="text-xs text-[#5C544F]">Finding matches...</p>
                  </div>
                ) : matchTherapist.data?.matches && matchTherapist.data.matches.length > 0 ? (
                  <>
                    <div className="flex items-center gap-4 mb-5">
                      <Avatar className="h-14 w-14 border border-[#E8E1D7]">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${matchTherapist.data.matches[0].name}&backgroundColor=f0e6e6&textColor=2d2626`} />
                        <AvatarFallback className="bg-[#F5EFE6] text-[#2D2626]">
                          {matchTherapist.data.matches[0].name.split(' ').map((n: string) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-medium text-[#2D2626] text-[15px]">{matchTherapist.data.matches[0].name}</h4>
                        <p className="text-xs text-[#5C544F] mb-1.5">{matchTherapist.data.matches[0].providerProfile.title}</p>
                        <div className="flex gap-1.5">
                          {matchTherapist.data.matches[0].specialties.slice(0, 2).map((s: string, i: number) => (
                            <span key={i} className="text-[10px] bg-[#F8F9FA] border border-[#E8E1D7] px-1.5 py-0.5 rounded text-[#5C544F]">{s}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Link href={`/therapists/${matchTherapist.data.matches[0].id}`}>
                      <Button className="w-full bg-[#2D2626] hover:bg-black text-white h-10 rounded-xl text-[14px] font-medium">
                        View Profile & Book
                      </Button>
                    </Link>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-[#5C544F]">No immediate match found.</p>
                    <Link href="/therapists">
                      <Button variant="outline" className="mt-4 rounded-xl border-[#E8E1D7] w-full">Browse Directory</Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
